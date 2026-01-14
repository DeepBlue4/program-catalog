export class MockApiData {
    static async simulateLatency(useTestData) {
        if (!useTestData) return;
        const ms = Math.floor(Math.random() * 800) + 800; // 800 - 1600ms
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static generateMockHierarchy() {
        // Deterministic Random Generator (Seeded)
        let seed = 5678;
        const random = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };

        const effortTypes = ['System', 'Service', 'Component', 'Application', 'Library'];

        // Updated pick to use deterministic random
        const pick = (arr) => arr[Math.floor(random() * arr.length)];

        // Scale Factor: Increase for larger tree
        const MAX_DEPTH = 4; // 0-indexed, so 5 levels
        const MIN_CHILDREN = 2;
        const MAX_CHILDREN = 5;

        const createNode = (depth, parentName, parentPath = '', forceName = null) => {
            // Deterministic ID generation logic
            const id = Math.floor(random() * 10000000);
            let name;

            if (forceName) {
                name = forceName;
            } else if (depth === 0) name = "Company PGC";
            else if (depth === 1) name = `${pick(['Space', 'Defense', 'Commercial', 'Global'])} Division ${id.toString().slice(-2)}`;
            else if (depth === 2) name = `${pick(['X', 'Y', 'Z', 'Alpha', 'Beta', 'Gamma', 'Delta'])} Program ${id.toString().slice(-3)}`;
            else if (depth === 3) name = `${pick(['Avionics', 'Propulsion', 'Software', 'Logistics', 'Mission', 'Ground'])} Team ${id.toString().slice(-3)}`;
            else name = `Unit ${Math.floor(random() * 1000)}`;

            const isTargetNeutral = name === "Commercial Division 37";

            // Program Properties
            const organization_leader_name = `Leader ${pick(['Smith', 'Johnson', 'Williams', 'Brown'])}`;
            const chief_engineer_name = `Eng. ${pick(['Davis', 'Miller', 'Wilson', 'Moore'])}`;
            const primary_location = pick(['Seattle, WA', 'St. Louis, MO', 'Huntsville, AL', 'Arlington, VA']);
            const program_type = pick(['Production', 'Development', 'Sustainment', 'R&D']);
            const program_value = `$${(random() * 100 + 10).toFixed(1)}M`;
            const description = `This is a mock description for ${name}. It contains generic information.`;
            const aliases = random() > 0.7 ? `Alias-${id}` : null;
            const status = "Green";

            const currentPath = parentPath ? `${parentPath}.${id}` : `${id}`;

            const isLeafCandidate = depth >= 3;
            const softwareEfforts = [];

            if (isLeafCandidate && !isTargetNeutral && random() > 0.3) {
                // Generate 1 to 5 efforts to ensure "more than just 1" is common
                const numEfforts = Math.floor(random() * 5) + 1;

                for (let j = 0; j < numEfforts; j++) {
                    const effId = `EFF-${id}-${j}`;
                    // Use closure-safe pick
                    const effType = pick(effortTypes);
                    // Differentiate names slightly
                    const baseName = name.split(' ')[0] || 'Project';
                    const effName = j === 0
                        ? `${baseName} Platform`
                        : `${baseName} ${effType} ${j + 1}`;

                    let parentId = null;
                    if (j > 0 && random() > 0.3) {
                        // Pick a random parent from 0 to j-1
                        const parentIndex = Math.floor(random() * j);
                        parentId = `EFF-${id}-${parentIndex}`;
                    }

                    softwareEfforts.push({
                        id: effId,
                        uuid: effId,
                        name: effName,
                        parent: parentId,
                        parent_uuid: parentId,

                        inherit_statement_of_work_profile: false,
                        statement_of_work_profile: {
                            program_manager_email: `manager.${j}@example.com`,
                            allow_non_us: random() > 0.5,
                            mission_critical: random() > 0.8,
                            program_phase: pick(['Design', 'Development', 'Production']),
                            security_clearance: [pick(['None', 'Secret'])],
                            safety_criticality: [pick(['None', 'DAL D / LOR 4'])]
                        },

                        inherit_technical_points_of_contact: false,
                        technical_points_of_contact: {
                            software_lead: `lead.${j}@example.com`,
                            security_focal: `sec.${j}@example.com`
                        },

                        inherit_developer_setup: false,
                        developer_setup: {
                            programming_languages: [pick(['Python', 'C++', 'Java'])],
                            operating_systems: [pick(['Linux', 'Windows'])],
                            development_environments: [pick(['BSF-Global', 'BSF-US'])],
                            source_control_tools: [pick(['GitLab', 'Bitbucket'])],
                            issue_tracking_tools: [pick(['Jira', 'GitLab'])],
                            dp_assessment_name: `DP-Assess-${j}`,
                            sbom_location: [pick(['Artifactory', 'Nexus'])]
                        },

                        inherit_work_location: false,
                        work_location: {
                            locations: [primary_location, 'Remote']
                        },

                        children: [],
                        linked_software_efforts: []
                    });
                }
            }

            const children = [];
            let hasDescendantExpecting = false;

            if (depth < MAX_DEPTH && !isTargetNeutral) {
                // If Root, ensure one child is Commercial Division 37
                const numChildren = Math.floor(random() * (MAX_CHILDREN - MIN_CHILDREN + 1)) + MIN_CHILDREN;

                for (let i = 0; i < numChildren; i++) {
                    let childNode;
                    // Force the neutral node as the FIRST child of Root
                    if (depth === 0 && i === 0) {
                        childNode = createNode(depth + 1, name, currentPath, "Commercial Division 37");
                    } else {
                        childNode = createNode(depth + 1, name, currentPath);
                    }
                    children.push(childNode);
                    if (childNode.hasSoftwareEffort || childNode.has_descendant_expecting_software_effort) {
                        hasDescendantExpecting = true;
                    }
                }
            }

            // Compliance Requirement simulation
            const expectsEffort = isLeafCandidate && random() > 0.4;
            if (expectsEffort) hasDescendantExpecting = true;

            return {
                // ProgramCatalogModel fields (implied/merged)
                id: id,
                program_id: id, // Replaces value for OrgChart/Frontend ID
                active: true,
                critical: random() > 0.9,

                // ProgramCatalogInfoModel fields
                date: new Date().toISOString().split('T')[0],
                name: name,
                program_path: currentPath,
                expect_software_effort: expectsEffort,
                description: description,
                aliases: aliases,
                status: status,
                primary_location: primary_location,
                organization_leader_name: organization_leader_name,
                chief_engineer_name: chief_engineer_name,
                program_affiliation: parentName, // Rough approx
                program_value: program_value,
                program_type: program_type,

                // Tree structure
                children: children,

                softwareEfforts: softwareEfforts,
                hasSoftwareEffort: softwareEfforts.length > 0,
                expecting_software_efforts: expectsEffort,
                has_descendant_expecting_software_effort: hasDescendantExpecting
            };
        };

        return createNode(0, "Root");
    }

    static getMockSoftwareEfforts(hierarchyNodeUUID) {
        const count = 45; // Test pagination
        const efforts = [];
        for (let i = 0; i < count; i++) {
            const effId = `eff-${hierarchyNodeUUID}-${i}`;
            // eslint-disable-next-line no-unused-vars
            const effType = i % 3 === 0 ? 'System' : 'Service';

            efforts.push({
                id: effId,
                uuid: effId,
                name: `Mock Effort ${i + 1}`,
                parent: null,
                parent_uuid: null,

                inherit_statement_of_work_profile: false,
                statement_of_work_profile: {
                    program_manager_email: `manager.${i}@example.com`,
                    allow_non_us: i % 2 === 0,
                    mission_critical: i % 4 === 0,
                    program_phase: 'Development',
                    security_clearance: ['None'],
                    safety_criticality: ['None']
                },

                inherit_technical_points_of_contact: false,
                technical_points_of_contact: {
                    software_lead: `lead.${i}@example.com`,
                    security_focal: `sec.${i}@example.com`
                },

                inherit_developer_setup: false,
                developer_setup: {
                    programming_languages: ['Python', 'Java'],
                    operating_systems: ['Linux'],
                    development_environments: ['BSF-Global'],
                    source_control_tools: ['GitLab'],
                    issue_tracking_tools: ['Jira'],
                    dp_assessment_name: `DP-Assess-${i}`,
                    sbom_location: ['Artifactory']
                },

                inherit_work_location: false,
                work_location: {
                    locations: ['Seattle, WA', 'Remote']
                },

                children: [],
                linked_software_efforts: []
            });
        }
        return efforts;
    }

    static getMockProgram(hierarchyNodeUUID) {
        return {
            program_id: hierarchyNodeUUID,
            program_name: "Mock Program",
            program_manager: "Jane Doe",
            description: "This is a mock program description.",
        };
    }

    static getMockUser() {
        return {
            username: "testuser",
            email: "test.user@company.com",
            first_name: "Test",
            last_name: "User",
        };
    }

    static getMockEmails() {
        const firstNames = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"];
        const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];

        const emails = [
            "jane.doe@company.com",
            "john.smith@company.com",
            "admin@company.com",
            "developer@company.com"
        ];

        // Generate more realistic emails
        for (let i = 0; i < 40; i++) {
            const fn = firstNames[Math.floor(Math.random() * firstNames.length)].toLowerCase();
            const ln = lastNames[Math.floor(Math.random() * lastNames.length)].toLowerCase();
            emails.push(`${fn}.${ln}@company.com`);
        }

        // Deduplicate
        return [...new Set(emails)].sort();
    }
}
