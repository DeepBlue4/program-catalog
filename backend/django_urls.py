from django.urls import include, path

from apps.swe_program_catalog.api import (
    CurrentUserEndpoint,
    EmailsEndpoint,
    EnterpriseHierarchyEndpoint,
    ProgramEndpoint,
    SoftwareEffortEndpoint,
)

from . import views
from .views import ProgramsViewUI

# Changed from "swe-program-catalog" to match the desired URL structure
app_name = "program-catalog"


urlpatterns = [
    # View UI URLs
    path(
        f"ui/{app_name}/",
        include(
            [
                path(
                    "", 
                    views.vue_app_view,
                    name="vue-app",
                ),
                path(
                    "programs",
                    ProgramsViewUI.as_view(),
                    name="programs-ui",
                ),
                path(
                    "enterprise-hierarchy",
                    EnterpriseHierarchyEndpoint.as_view(),
                    name="enterprise-hierarchy",
                ),
                path(
                    "enterprise-hierarchy/<str:id>",
                    ProgramEndpoint.as_view(),
                    name="program",
                ),
                path(
                    "enterprise-hierarchy/<str:id>/software-effort",
                    SoftwareEffortEndpoint.as_view(),
                    name="software-effort",
                ),
                path(
                    "enterprise-hierarchy/delete-software-effort/<str:id>",
                    SoftwareEffortEndpoint.as_view(),
                    name="software-effort-delete",
                ),
                path(
                    "current-user",
                    CurrentUserEndpoint.as_view(),
                    name="current-user",
                ),
                path(
                    "emails",
                    EmailsEndpoint.as_view(),
                    name="emails",
                ),
            ],
        ),
    ),
]
