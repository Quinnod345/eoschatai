# EOS Implementer Persona Configuration

## Overview
The EOS Implementer persona has been configured with exactly four profiles as requested. These profiles represent the core facilitation roles for EOS implementation.

## Configured Profiles

### 1. Quarterly Session Facilitator
- **Purpose**: Focus on quarterly planning sessions and Rock setting
- **Knowledge Base**: `eos-implementer-quarterly-planning`
- **Key Activities**:
  - Previous quarter review
  - Rock completion assessment
  - New Rock identification and setting
  - Scorecard updates
  - Issue prioritization

### 2. Focus Day Facilitator
- **Purpose**: Focus on facilitating Focus Days for leadership teams
- **Knowledge Base**: `eos-implementer-focus-day`
- **Key Activities**:
  - Check-in and segue
  - V/TO review and updates
  - IDS (Identify, Discuss, Solve) sessions
  - Action item documentation
  - EOS discipline reinforcement

### 3. Vision Building Day 1 Facilitation
- **Purpose**: Focus on the first day of Vision Building - People and Data components
- **Knowledge Base**: `eos-implementer-vision-day-1`
- **Key Activities**:
  - Core Values identification
  - Accountability Chart creation
  - Right People, Right Seats assessment
  - Scorecard development
  - Key metrics identification

### 4. Vision Building Day 2 Facilitator
- **Purpose**: Focus on the second day of Vision Building - Vision, Issues, Process, and Traction
- **Knowledge Base**: `eos-implementer-vision-day-2`
- **Key Activities**:
  - Core Focus development
  - 10-Year Target setting
  - 3-Year Picture creation
  - 1-Year Plan development
  - Rock setting for implementation

## Implementation Details

### Database Update Script
The script at `/scripts/setup-system-eos-persona.ts` has been updated to:
1. Create only these four profiles
2. Delete any existing profiles not in this list
3. Update existing profiles with current instructions

### Knowledge Base Structure
Each profile has a corresponding knowledge base directory:
- `/knowledge-base/eos-implementer-quarterly-planning/`
- `/knowledge-base/eos-implementer-focus-day/`
- `/knowledge-base/eos-implementer-vision-day-1/`
- `/knowledge-base/eos-implementer-vision-day-2/`

### Running the Update
To apply these profile changes to the database:
```bash
npx tsx scripts/setup-system-eos-persona.ts
```

Note: The database must be accessible when running this script.

## Profile Selection
Users with the EOS Implementer persona will see these four profiles in the profile dropdown, allowing them to switch context based on the type of session they're facilitating.