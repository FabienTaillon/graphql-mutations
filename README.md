# GraphQL Mutations in LWC — Conference Check-in Demo

Demo project for the Dreamforce 2026 session **"Query and Update Records with GraphQL Mutations in LWC"**.

One business story carries the whole session: you're staffing the **check-in desk of a
conference**. Sponsors are Accounts, attendees are Contacts, and every gesture at the desk
is a GraphQL mutation — create, chained create, mass update, cross-sObject update — in pure
JavaScript with `executeMutation` from the `lightning/graphql` module (GA in Spring '26),
while leveraging Lightning Data Service caching.

## Demo flow

All demos live in the **GraphQL Mutations** Lightning app, on the **GraphQL Mutations** tab
(a single app page hosting `c-graphql-demo-app`, a tabset that follows the story):

| Tab | Business gesture | Component | GraphQL concept |
| --- | --- | --- | --- |
| 1. Walk-in | Someone shows up unregistered — register them | `graphqlCreateContact` | `ContactCreate` with typed variables (`ContactCreateInput!`), plus a `graphql` wire and its `refresh()` |
| 2. Sponsor Group | A sponsor company arrives with N unregistered people | `graphqlChainedCreate` | Account + N Contacts created **linked** in one atomic request via the chained reference `AccountId: "@{account}"` |
| 3. Check-in Queue | The morning rush — tick "Checked In" on a whole list | `graphqlMassUpdate` | One aliased `ContactUpdate` per edited row in **one** mutation document, `allOrNone: false` |
| 4. Sponsor Upgrade | A sponsor doubles its budget → Gold tier + all badges VIP | `graphqlCrossObject` | One atomic request across **two sObject types** (`AccountUpdate` + N `ContactUpdate`, `allOrNone: true`) |
| 5. Welcome Screen | The desk checks someone in, the welcome screen follows | `graphqlLdsCache` | The mutation's selection set queries back changed fields; LDS ingests them and a standard `lightning-record-view-form` updates with zero refresh code |

Three custom fields support the story: `Contact.Checked_In__c` (checkbox),
`Contact.Badge_Type__c` (Attendee/VIP/Speaker), `Account.Sponsor_Tier__c` (Bronze/Silver/Gold).

## Key API points

```js
import { gql, graphql, executeMutation } from 'lightning/graphql';
```

- `lightning/graphql` supersedes `lightning/uiGraphQLApi`.
- `executeMutation({ query, variables, operationName })` is imperative only (no `@wire`), returns `{ data, errors }`.
- Mutation fields follow `<Object>Create | <Object>Update | <Object>Delete` with `<Object><Op>Input!` input types.
- The `graphql` wire result now exposes a `refresh()` function — no `refreshApex` needed. To defer a wire, return `undefined` from the *query* getter (an undefined `variables` map crashes the adapter).
- Deleted records are removed from wire results automatically; created/updated records need a `refresh()` (updates partially propagate when the mutation selection set overlaps cached fields).
- Operations in one document can be mixed (Create/Update/Delete, any sObjects) and **chained**: `"@{alias}"` (v59+), `"@{alias.Record.Id}"` / `"@{alias.Record.Field.value}"` (v67+) reference an earlier operation's result — works inline and through variables. The referencing operation must come after the one it references. Nested child payloads (sObject-tree style) are NOT supported.

## Prerequisites

- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`)
- A Dev Hub org, authenticated with `sf org login web --set-default-dev-hub`

## Setup

One script does it all: scratch org, deploy, permission set, sample data, and opens the demo tab.
The alias defaults to `<project>-<branch>` (for instance `graphql-mutations-main`), or pass your own.

```sh
./createScratchOrg.sh
./createScratchOrg.sh gql-mutations
```

Step by step, the script runs:

```sh
# Create a scratch org
sf org create scratch -f config/project-scratch-def.json -a gql-mutations -d -w 15

# Deploy
sf project deploy start -o gql-mutations

# Grant access to the demo app, tab, and check-in fields
sf org assign permset -n GraphQL_Mutations_Demo -o gql-mutations

# Sample data (3 sponsor Accounts, 7 attendee Contacts)
sf data import tree -p data/Account-Contact-plan.json -o gql-mutations

# Optional, only if texei-sfdx-plugin is installed: remove unused standard layouts
sf texei source layouts cleanorg -o gql-mutations

# Start source tracking from a clean state
sf project reset tracking -p -o gql-mutations

# Open the demo
sf org open -o gql-mutations -p /lightning/n/GraphQL_Mutations_Demo
```
