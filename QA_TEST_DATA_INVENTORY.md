# QA TEST DATA INVENTORY (QA_20260916120010)

> **NOTICE**: Do not delete test data during verification. This inventory lists all QA test entities created across test phases.

| TYPE | ID | ORGANIZATION | CREATED_BY_TEST | SAFE_TO_DELETE | DEPENDENCIES |
| :--- | :--- | :--- | :--- | :--- | :--- |
| organization | `QA_20260916120010_ORG_A` | QA Organization A | Test 6: Org Creation | YES | none |
| organization | `QA_20260916120010_ORG_B` | QA Organization B | Test 6: Org Creation | YES | none |
| user | `QA_20260916120010_USER_A` | QA_20260916120010_ORG_A | Test 9: Tenant User A | YES | none |
| user | `QA_20260916120010_USER_B` | QA_20260916120010_ORG_B | Test 9: Tenant User B | YES | none |
| course | `QA_20260916120010_COURSE_A` | QA_20260916120010_ORG_A | Test 13: Course Lifecycle | YES | none |
| cohort | `QA_20260916120010_COHORT_A` | QA_20260916120010_ORG_A | Test 15: Cohort Lifecycle | YES | none |
| invitation | `QA_20260916120010_INVITE_TOKEN_A` | QA_20260916120010_ORG_A | Test 11: Invitation Token | YES | none |
