# ##############################################################################
# ##############################################################################
# #
# #                            BOEING PROPRIETARY
# #                        CLASSIFICATION: UNCLASSIFIED
# #                   Unpublished Work - All Rights Reserved
# #                             Copyright 2024-2025
# #                   Contract: Boeing Funded Development
# #              Third Party Disclosure Requires Written Approval
# #
# ##############################################################################
import uuid


from cachetools import TTLCache, cached
from django.db import transaction
from django.db.models import ManyToManyField, Max
from log.log_handler import logger
from utils.compass_decorators import singleton

from apps.swe_program_catalog.models import (
    DeveloperSetupModel,
    ProgramCatalogInfoModel,
    SoftwareEffortModel,
    StatementOfWorkProfileModel,
    TechnicalPointOfContactModel,
    WorkLocationModel,
)
from apps.swe_program_catalog.serializers import (
    ProgramCatalogInfoSerializer,
    SoftwareEffortSerializer,
)
from models.program.program import Program, ProgramTreeNode
from models.program.software_effort import SoftwareEffort


@singleton
class ProgramCatalogService:
    """
    Entry point for fetching data from the Program Catalog.
    """

    def delete_effort_by_uuid(self, effort_uuid: str) -> bool:
        """
        Delete a SoftwareEffort and its related local objects by UUID.

        This method performs a hard delete of the `SoftwareEffortModel`
        identified by `effort_uuid`.

        Parameters:
            effort_uuid (str): UUID of the `SoftwareEffortModel` to delete.

        Returns:
            bool: `True` if the effort (and related local objects) were
                  deleted, `False` if no effort with the provided UUID exists.
        """
        try:
            valid_uuid = uuid.UUID(effort_uuid)
        except (ValueError, AttributeError, TypeError) as e:
            logger.warning(
                "Invalid effort UUID provided: %r (%s)", effort_uuid, e
            )
            return False

        try:
            effort = SoftwareEffortModel.objects.get(uuid=valid_uuid)
        except SoftwareEffortModel.DoesNotExist:
            logger.info("No SoftwareEffort found with UUID: %s", valid_uuid)
            return False
        # TODO: Need to refactor this delete method to soft delete and update
        # Program Catalog to not display archived efforts Issue: #1467
        with transaction.atomic():
            # Check *_id to avoid fetching related object if it doesn't exist
            if effort.local_statement_of_work_profile_id:
                effort.local_statement_of_work_profile.hard_delete()

            if effort.local_developer_setup_id:
                effort.local_developer_setup.hard_delete()

            if effort.local_technical_points_of_contact_id:
                effort.local_technical_points_of_contact.hard_delete()

            if effort.local_work_location_id:
                effort.local_work_location.hard_delete()
            effort.hard_delete()
        return True

    def _get_latest_programs(self):
        """
        Helper for getting the latest version date of each active software
        program.

        Returns:
            QuerySet: Grouped by program_id with Max("date")
        """
        return (
            ProgramCatalogInfoModel.objects.filter(program__active=True)
            # Fix: Explicitly group by program_id before annotating
            .values("program_id")
            .annotate(latest_date=Max("date"))
        )

    def _convert_program_catalog_info_to_dto(
        self, program_model: ProgramCatalogInfoModel, pydantic_model=Program
    ) -> Program | ProgramTreeNode:

        serialized_data = ProgramCatalogInfoSerializer(program_model).data
        # From the info model the ID is in the program field
        serialized_data["program_id"] = serialized_data["program"]
        return pydantic_model.model_validate(serialized_data)

    def get_efforts_for_program(self, id: str) -> list[SoftwareEffort] | None:
        """
        Get all software efforts for a specific program.

        Args:
            id (str): The 'program_id' (Business ID) of the program (e.g.,
                      '101', '505').
                      NOTE: This is NOT the database UUID of the
                      ProgramCatalogInfoModel.

        Returns:
            list[SoftwareEffort] | None: A list of software efforts or None if
                                         program not found.
        """
        logger.info(
            "[get_efforts_for_program] Fetching efforts for "
            "program_id: "  # noqa: E501
            "%s", id  # noqa: E501
        )

        # 1. Fetch the latest active program info to ensure we match the correct version.
        # This mirrors the logic in get_program_by_id logic.
        latest_program_info = self._get_latest_programs()

        # 2. Look up the ProgramCatalogInfoModel using the business 'program_id'
        # filtered by the latest date to get the current active record.
        program = ProgramCatalogInfoModel.objects.filter(
            program_id=id,
            date__in=latest_program_info.values("latest_date")
        ).first()

        if program is None:
            logger.warning("[get_efforts_for_program] Program NOT found for program_id: %s", id)
            return None

        # 3. Retrieve Software Efforts associated with this specific program info instance.
        software_efforts = SoftwareEffortModel.objects.filter(program_catalog_info=program)

        logger.info(
            "[get_efforts_for_program] Found %d efforts for program %s (pk=%s)",
            software_efforts.count(), id, program.pk
        )

        serialized_data = SoftwareEffortSerializer(software_efforts, many=True).data

        return [SoftwareEffort.model_validate(item) for item in serialized_data]

    def _create_effort_relation(self, effort_data, django_model):
        """
        Helper to create a related profile or object if data is present.
        """
        relation_data = effort_data.model_dump() if effort_data is not None else None
        relation = None
        if relation_data:
            relation = django_model.objects.create(**relation_data)
        return relation

    def save_efforts_for_program(self, id: str, new_effort_data: SoftwareEffort):
        """
        Save a single SoftwareEffortModel instance for a program.
        Updates it if it exists (by UUID), or creates a new one.
        Handles checking of `inherit_*` flags and managing `local_*` profile objects.

        If updating:
         - The existing effort is looked up by `new_effort_data.uuid`.
         - If found, its scalar fields are updated.
         - For each local profile (SOW, Contacts, etc.):
            * If `inherit_X` is now True, we hard-delete the old local profile (if any)
              and set the FK to None.
            * If `inherit_X` is False and we have data, we either update the existing local profile
              or create a new one if it was missing.
         - Parent and linked efforts are resolved and updated.

        If creating:
         - A new SoftwareEffortModel is created.
         - Local profiles are created if `inherit_X` is False.
         - Parent and linked efforts are resolved.
        """

        logger.info(
            "save_efforts_for_program: start [DEBUG] incoming_id=%r (type=%s) for effort=%s",
            id, type(id), getattr(new_effort_data, "name", "Unknown"),
        )

        # Guard: Ensure we have data
        if not new_effort_data:
            logger.warning("save_efforts_for_program called with None or empty effort data")
            return

        # Resolve Program Instance
        # Per user request: incoming 'id' is always treated as 'program_id', never a UUID.
        logger.debug("save_efforts_for_program: Looking up Program by program_id=%r", id)

        program_instance = ProgramCatalogInfoModel.objects.filter(program_id=id).first()

        if not program_instance:
            logger.error("save_efforts_for_program: Program NOT found for program_id=%r. Aborting.", id)
            # Depending on requirements, raise error or return
            return

        logger.info("save_efforts_for_program: Resolved Program Instance -> pk=%s, program_id=%s",
                    program_instance.pk, program_instance.program_id)

        with transaction.atomic():
            # 1. Resolve Parent Instance (if provided)
            # ----------------------------------------
            parent_instance = None
            parent_uuid_val = getattr(new_effort_data, "parent_uuid", None)
            if parent_uuid_val:
                try:
                    # Parent must theoretically already exist in DB if we are linking to it.
                    # Or it could be that we are creating a tree in order?
                    # Assuming basic case: parent exists.
                    parent_instance = SoftwareEffortModel.objects.filter(uuid=parent_uuid_val).first()
                    if not parent_instance:
                        logger.warning(
                            "Parent UUID %s provided but not found in DB. Effort will be orphaned.",
                            parent_uuid_val
                        )
                except Exception as e:
                    logger.warning("Invalid parent_uuid %s: %s", parent_uuid_val, e)

            # 2. Identify if we are creating vs updating
            # ------------------------------------------
            effort_uuid = getattr(new_effort_data, "uuid", None)
            instance = None

            if effort_uuid:
                instance = SoftwareEffortModel.objects.filter(uuid=effort_uuid).first()

            # Helper for local profile management logic
            def manage_local_profile(
                effort_inst,
                inherit_flag: bool,
                input_profile_data,
                model_class,
                fk_field_name: str
            ):
                """
                fk_field_name e.g. "local_statement_of_work_profile"
                Returns the model instance (or None) that should be assigned to the FK.
                """
                existing_rel = getattr(effort_inst, fk_field_name, None)

                # CASE A: Inherit is TRUE -> Delete local override if it exists, return None
                if inherit_flag:
                    if existing_rel:
                        # Depending on requirements, we usually delete the orphaned profile to keep DB clean
                        existing_rel.hard_delete()
                    return None

                # CASE B: Inherit is FALSE -> We need a local profile
                if not input_profile_data:
                    # Edge case: Inherit false, but no data provided?
                    # Usually means keep existing if present, or do nothing (None).
                    # If we interpret "no data" as "clear it", then delete.
                    # Let's assume we update if data is present, else leave as is?
                    # Or strictly: no data => None?
                    # Recommendation: If data is None and inherit is False, maybe we can't create one.
                    # But if we have an existing one, we might keep it.
                    return existing_rel

                # We have input data.
                if existing_rel:
                    # Update existing
                    for k, v in input_profile_data.model_dump().items():
                        setattr(existing_rel, k, v)
                    existing_rel.save()
                    return existing_rel
                else:
                    # Create new
                    return self._create_effort_relation(input_profile_data, model_class)


            if instance:
                logger.info("Updating existing effort uuid=%s pk=%s", effort_uuid, instance.pk)

                # Update scalars
                instance.name = new_effort_data.name
                instance.program_catalog_info = program_instance # Use resolved instance

                # Update inheritance flags
                instance.inherit_statement_of_work_profile = new_effort_data.inherit_statement_of_work_profile
                instance.inherit_technical_points_of_contact = new_effort_data.inherit_technical_points_of_contact
                instance.inherit_developer_setup = new_effort_data.inherit_developer_setup
                instance.inherit_work_location = new_effort_data.inherit_work_location

                # Update Parent
                instance.parent = parent_instance

                # Manage Profiles
                instance.local_statement_of_work_profile = manage_local_profile(
                    instance,
                    new_effort_data.inherit_statement_of_work_profile,
                    new_effort_data.statement_of_work_profile,
                    StatementOfWorkProfileModel,
                    "local_statement_of_work_profile"
                )

                instance.local_technical_points_of_contact = manage_local_profile(
                    instance,
                    new_effort_data.inherit_technical_points_of_contact,
                    new_effort_data.technical_points_of_contact,
                    TechnicalPointOfContactModel,
                    "local_technical_points_of_contact"
                )

                instance.local_developer_setup = manage_local_profile(
                    instance,
                    new_effort_data.inherit_developer_setup,
                    new_effort_data.developer_setup,
                    DeveloperSetupModel,
                    "local_developer_setup"
                )

                instance.local_work_location = manage_local_profile(
                    instance,
                    new_effort_data.inherit_work_location,
                    new_effort_data.work_location,
                    WorkLocationModel,
                    "local_work_location"
                )

                instance.save()

            else:
                logger.info("Creating new effort (uuid=%s)", effort_uuid)

                # Create profiles first (if not inheriting)
                sow_profile = None
                if (not new_effort_data.inherit_statement_of_work_profile
                    and new_effort_data.statement_of_work_profile):
                    sow_profile = self._create_effort_relation(
                        new_effort_data.statement_of_work_profile, StatementOfWorkProfileModel
                    )

                tech_contacts = None
                if (not new_effort_data.inherit_technical_points_of_contact
                    and new_effort_data.technical_points_of_contact):
                    tech_contacts = self._create_effort_relation(
                        new_effort_data.technical_points_of_contact, TechnicalPointOfContactModel
                    )

                developer_setup = None
                if (not new_effort_data.inherit_developer_setup
                    and new_effort_data.developer_setup):
                    developer_setup = self._create_effort_relation(
                        new_effort_data.developer_setup, DeveloperSetupModel
                    )

                work_location = None
                if (not new_effort_data.inherit_work_location
                    and new_effort_data.work_location):
                    work_location = self._create_effort_relation(
                        new_effort_data.work_location, WorkLocationModel
                    )

                instance = SoftwareEffortModel.objects.create(
                    program_catalog_info=program_instance, # Use resolved instance
                    name=new_effort_data.name,
                    parent=parent_instance,
                    # Inheritance flags
                    inherit_statement_of_work_profile=new_effort_data.inherit_statement_of_work_profile,
                    inherit_technical_points_of_contact=new_effort_data.inherit_technical_points_of_contact,
                    inherit_developer_setup=new_effort_data.inherit_developer_setup,
                    inherit_work_location=new_effort_data.inherit_work_location,
                    # Local profiles
                    local_statement_of_work_profile=sow_profile,
                    local_technical_points_of_contact=tech_contacts,
                    local_developer_setup=developer_setup,
                    local_work_location=work_location,
                )

            # 3. Handle Linked Software Efforts (Third Pass logic equivalent)
            # -------------------------------------------------------------
            raw_links = getattr(new_effort_data, "linked_software_efforts", None)
            if raw_links is not None:
                # We reuse the logic: resolve identifiers -> update relation

                def resolve_identifier_to_instance(identifier):
                    # For a single save, we look up in DB.
                    # We don't have a "uuid_to_instance" map of peer creations here since we only process one.
                    if not identifier:
                        return None

                    found = SoftwareEffortModel.objects.filter(uuid=identifier).first()
                    if found:
                        return found

                    # Numeric fallback
                    if str(identifier).isdigit():
                        found_pk = SoftwareEffortModel.objects.filter(pk=int(identifier)).first()
                        if found_pk:
                            return found_pk
                    return None

                # Check if M2M or JSON
                link_field_is_m2m = False
                try:
                    field_obj = SoftwareEffortModel._meta.get_field("linked_software_efforts")
                    if isinstance(field_obj, ManyToManyField):
                        link_field_is_m2m = True
                except Exception:
                    pass

                resolved_targets = []
                resolved_ids = []

                for raw_item in raw_links:
                    # identifier extraction
                    identifier = None
                    if isinstance(raw_item, dict):
                        for k in ("uuid", "id", "pk"):
                            if raw_item.get(k):
                                identifier = str(raw_item[k])
                                break
                    else:
                        identifier = str(raw_item).strip()

                    target = resolve_identifier_to_instance(identifier)
                    if target:
                        resolved_targets.append(target)
                        resolved_ids.append(str(target.uuid) if hasattr(target, 'uuid') else str(target.pk))
                    else:
                        # Cannot link
                        logger.warning("Could not resolve linked effort: %s", raw_item)
                        # For JSON, we might store the raw ID?
                        resolved_ids.append(identifier)

                if link_field_is_m2m:
                    instance.linked_software_efforts.set(resolved_targets)
                else:
                    instance.linked_software_efforts = resolved_ids
                    instance.save()

            logger.info("save_efforts_for_program: completed for effort %s", instance.pk)


    def get_all_programs_as_tree(self) -> ProgramTreeNode | None:
        """
        Gets all programs represented as a tree.
        Optimized to use fewer DB queries and reduced serialization overhead.

        Returns:
            ProgramTreeNode: the tree root
        """
        # Fetch dicts only (no model instances)
        # IMPORTANT: Create a copy to avoid mutating the cached list!
        # The original list is cached by _get_all_program_dicts, and .sort()/.pop()
        # would mutate it, causing the root node to be missing on subsequent requests.
        program_data = list(self._get_all_program_dicts())

        if not program_data:
            return None

        # Sort by depth (number of segments in program_id_path)
        # Assuming program_path is like "1", "1.2", "1.2.3"
        program_data.sort(key=lambda p: len(p["program_path"].split(".")))

        if not program_data:
            return None

        # Convert to Pydantic/Dict structure
        # We manually construct to avoid serializer overhead
        def map_to_dto(p_dict):
            # p_dict has snake_case keys from DB values()
            return ProgramTreeNode(
                program_name=p_dict["name"],
                program_id=p_dict["program_id"],
                program_path=p_dict["program_path"],
                description=p_dict["description"],
                primary_location=p_dict["primary_location"],
                status=p_dict["status"],
                organization_leader_name=p_dict["organization_leader_name"],
                chief_engineer_name=p_dict["chief_engineer_name"],
                program_type=p_dict["program_type"],
                program_value=p_dict["program_value"],
            )

        def get_parent_id_path(path: str) -> str:
            if "." not in path: return ""
            return path.rsplit(".", 1)[0]

        # Analyze Roots
        # The sorted list has shallowest nodes first.
        # Find how many nodes are at the top level (min depth)

        first_depth = len(program_data[0]["program_path"].split("."))
        root_candidates_count = 0
        for p in program_data:
            if len(p["program_path"].split(".")) == first_depth:
                root_candidates_count += 1
            else:
                break # Sorted by depth, so we can stop early

        root_node = None
        id_path_to_node = {}
        nodes_by_path = []

        if root_candidates_count > 1:
            # Multiple Roots -> Error as per user requirement.
            # This indicates a data integrity issue where multiple programs are at the top level.
            msg = f"Database integrity error: Found {root_candidates_count} root nodes. The hierarchy must have exactly one root."
            logger.error(msg)
            # Log the unexpected roots for debugging
            for p in program_data[:root_candidates_count]:
                 logger.error("Candidate root: %s (path='%s')", p["name"], p["program_path"])

            raise ValueError(msg)

        else:
            # Single Root -> Original Behavior
            root_data = program_data.pop(0)
            root_node = map_to_dto(root_data)
            root_node.expecting_software_efforts = root_data["expect_software_effort"]
            root_node.has_descendant_expecting_software_effort = False

            id_path_to_node[root_data["program_path"]] = root_node
            nodes_by_path.append(root_node)

            processing_list = program_data

        # Populate Tree
        # Nodes are sorted by depth, so parents usually exist before children
        for p_dict in processing_list:
            parent_path = get_parent_id_path(p_dict["program_path"])
            parent_node = id_path_to_node.get(parent_path)

            if parent_node is None:
                # If we have a virtual root, we might have nested orphans, but logic holds.
                # If single root, logic holds.
                logger.warning(
                    "[get_all_programs_as_tree] Orphan found! Node '%s' (path=%s) is missing parent '%s'. Skipping.",
                    p_dict["name"], p_dict["program_path"], parent_path
                )
                continue

            child_node = map_to_dto(p_dict)
            child_node.expecting_software_efforts = p_dict["expect_software_effort"]
            child_node.has_descendant_expecting_software_effort = False

            parent_node.children.append(child_node)
            id_path_to_node[p_dict["program_path"]] = child_node
            nodes_by_path.append(child_node)

        # Bubble Up "has_descendant_expecting_software_effort"
        # Iterate in reverse (leaves to root)
        for node in reversed(nodes_by_path):
            # If this node has it (either own or from descendant), parent gets it
            is_relevant = (
                getattr(node, 'expecting_software_efforts', False) or
                getattr(
                    node,
                    'has_descendant_expecting_'  # noqa: E501
                    'software_effort',  # noqa: E501
                    False
                )
            )

            if is_relevant:
                parent_path = get_parent_id_path(node.program_path)
                if parent_path and parent_path in id_path_to_node:
                    parent = id_path_to_node[parent_path]
                    parent.has_descendant_expecting_software_effort = True

        return root_node

    @cached(cache=TTLCache(maxsize=3000, ttl=60))
    def _get_all_program_dicts(self) -> list[dict]:
        """Gets all programs as dicts. Optimized."""
        latest_program_info = self._get_latest_programs()

        # Values to fetch
        fields = [
            "program_id", "program_path", "name", "date",
            "expect_software_effort", "description", "aliases", "status",
            "primary_location", "organization_leader_name",
            "chief_engineer_name",
            "program_affiliation", "program_value", "program_type"
        ]

        result = (
            ProgramCatalogInfoModel.objects.filter(
                program__active=True,
                date__in=latest_program_info.values("latest_date")
            )
            # Sort deterministically to handle multiple entries on same date.
            .order_by(
                "program_id", "-date", "-id"
            )
            .distinct("program_id")
            .values(*fields)
        )
        return list(result)

    def get_all_programs(self) -> list[Program]:
        # Refactor this to use the dicts too if needed, or leave as is if not
        # critical path
        # Assuming get_all_programs_as_tree is the main visualization
        # bottleneck
        # I'll implement _get_all_program_models to return models if needed,
        # OR just map dicts to Program objects.
        return [
            self._convert_program_catalog_info_to_dto(
                ProgramCatalogInfoModel(**d)
            )
            for d in self._get_all_program_dicts()
        ]

    def get_program_by_uuid(self, id: str) -> Program:
        """Get program data for an ID.

        Args:
            id (str): The ID of the program to fetch

        Returns:
            SoftwareProgramInfo: None if no match was found.
        """
        latest_program_info = self._get_latest_programs()
        result = ProgramCatalogInfoModel.objects.filter(
            program__active=True,
            id=id,
            date__in=latest_program_info.values("latest_date"),
        )
        model = result.first()
        return self._convert_program_catalog_info_to_dto(model)

    def get_program_by_id(self, id: int) -> Program:
        """Get program data for an ID.

        Args:
            id (int): The ID of the program to fetch

        Returns:
            SoftwareProgramInfo: None if no match was found.
        """
        latest_program_info = self._get_latest_programs()
        result = ProgramCatalogInfoModel.objects.filter(
            program__active=True,
            program_id=id,
            date__in=latest_program_info.values("latest_date"),
        )
        model = result.first()
        return self._convert_program_catalog_info_to_dto(model)
