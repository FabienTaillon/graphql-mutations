# GraphQL Mutations in LWC — Demo

Demo project for the session **"GraphQL Mutations in LWC: query and update without Apex"**.

Create, mass update, and delete records across sObjects with pure JavaScript — no Apex —
using `executeMutation` from the `lightning/graphql` module (GA in Spring '26),
while leveraging Lightning Data Service caching.

## Demo components

All demos live in the **GraphQL Mutations** Lightning app, on the **GraphQL Mutations** tab
(a single app page hosting `c-graphql-demo-app`, a tabset that follows the session flow):

| Tab | Component | What it shows |
| --- | --- | --- |
| 1. Create | `graphqlCreateContact` | `executeMutation` + `ContactCreate` with typed GraphQL variables (`ContactCreateInput!`), plus a `graphql` wire and its `refresh()` function |
| 2. Chained Create | `graphqlChainedCreate` | Account + N Contacts created **linked** in one atomic request: contacts use the chained field reference `AccountId: "@{account}"`, resolved server-side to the Id of the account created earlier in the same document |
| 3. Mass Update | `graphqlMassUpdate` | Inline-edit datatable; every draft row becomes an aliased `ContactUpdate` operation in **one** mutation document, with `allOrNone: false` for partial success |
| 4. Across sObjects | `graphqlCrossObject` | One atomic request (`allOrNone: true`) that updates an Account **and** all of its Contacts — two sObject types in a single mutation |
| 5. LDS Cache | `graphqlLdsCache` | The mutation's selection set queries back the changed fields; LDS ingests the response and a standard `lightning-record-view-form` updates itself with zero refresh code |

## Key API points

```js
import { gql, graphql, executeMutation } from 'lightning/graphql';
```

- `lightning/graphql` supersedes `lightning/uiGraphQLApi`.
- `executeMutation({ query, variables, operationName })` is imperative only (no `@wire`), returns `{ data, errors }`.
- Mutation fields follow `<Object>Create | <Object>Update | <Object>Delete` with `<Object><Op>Input!` input types.
- The `graphql` wire result now exposes a `refresh()` function — no `refreshApex` needed.
- Deleted records are removed from wire results automatically; created/updated records need a `refresh()` (updates partially propagate when the mutation selection set overlaps cached fields).
- Operations in one document can be mixed (Create/Update/Delete, any sObjects) and **chained**: `"@{alias}"` (v59+), `"@{alias.Record.Id}"` / `"@{alias.Record.Field.value}"` (v67+) reference an earlier operation's result — works inline and through variables. The referencing operation must come after the one it references. Nested child payloads (sObject-tree style) are NOT supported.

## Setup

```sh
# Create a scratch org
sf org create scratch -f config/project-scratch-def.json -a gql-mutations -d -y 7

# Deploy
sf project deploy start -o gql-mutations

# Grant access to the demo app and tab
sf org assign permset -n GraphQL_Mutations_Demo -o gql-mutations

# Sample data (3 Accounts, 7 Contacts)
sf data tree import -p data/Account-Contact-plan.json -o gql-mutations

# Open the demo
sf org open -o gql-mutations -p /lightning/n/GraphQL_Mutations_Demo
```
