import { LightningElement, wire } from 'lwc';
import { gql, graphql, executeMutation } from 'lightning/graphql';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const COLUMNS = [
    { label: 'First Name', fieldName: 'FirstName', editable: true },
    { label: 'Last Name', fieldName: 'LastName', editable: true },
    { label: 'Title', fieldName: 'Title', editable: true },
    { label: 'Phone', fieldName: 'Phone', type: 'phone', editable: true },
    { label: 'Email', fieldName: 'Email', type: 'email', editable: true },
    { label: 'Account', fieldName: 'AccountName' }
];

export default class GraphqlMassUpdate extends LightningElement {
    columns = COLUMNS;
    draftValues = [];
    contacts;
    errors;
    lastRequestSummary;
    refreshGraphQL;

    @wire(graphql, {
        query: gql`
            query contactsToEdit {
                uiapi {
                    query {
                        Contact(
                            first: 50
                            orderBy: { Name: { order: ASC } }
                        ) {
                            edges {
                                node {
                                    Id
                                    FirstName {
                                        value
                                    }
                                    LastName {
                                        value
                                    }
                                    Title {
                                        value
                                    }
                                    Phone {
                                        value
                                    }
                                    Email {
                                        value
                                    }
                                    Account {
                                        Name {
                                            value
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `
    })
    wiredContacts(result) {
        const { errors, data, refresh } = result;
        if (refresh) {
            this.refreshGraphQL = refresh;
        }
        if (data) {
            this.contacts = data.uiapi.query.Contact.edges.map((edge) => ({
                Id: edge.node.Id,
                FirstName: edge.node.FirstName.value,
                LastName: edge.node.LastName.value,
                Title: edge.node.Title.value,
                Phone: edge.node.Phone.value,
                Email: edge.node.Email.value,
                AccountName: edge.node.Account?.Name.value
            }));
        }
        if (errors) {
            this.errors = errors;
        }
    }

    async handleSave(event) {
        const drafts = event.detail.draftValues;
        this.errors = undefined;

        // ONE GraphQL document containing one aliased ContactUpdate
        // operation per edited row — a single round trip, no Apex.
        const { query, variables } = this.buildMassUpdate(drafts);

        try {
            const result = await executeMutation({ query, variables });

            if (result.errors) {
                this.errors = result.errors;
            } else {
                this.draftValues = [];
                this.lastRequestSummary = `${drafts.length} record(s) updated in 1 GraphQL request`;
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Mass update complete',
                        message: this.lastRequestSummary,
                        variant: 'success'
                    })
                );
                await this.refreshGraphQL?.();
            }
        } catch (error) {
            this.errors = [error];
        }
    }

    buildMassUpdate(drafts) {
        const variables = {};
        const varDefs = [];
        const operations = [];

        drafts.forEach((draft, index) => {
            const { Id, ...fields } = draft;
            variables[`input${index}`] = { Id, Contact: fields };
            varDefs.push(`$input${index}: ContactUpdateInput!`);
            operations.push(
                `update${index}: ContactUpdate(input: $input${index}) { success }`
            );
        });

        // allOrNone: false → partial success is allowed, like Database.update
        const query = gql`
            mutation massUpdateContacts(${varDefs.join(', ')}) {
                uiapi(input: { allOrNone: false }) {
                    ${operations.join('\n')}
                }
            }
        `;
        return { query, variables };
    }

    get errorMessages() {
        return this.errors?.map((e, i) => ({
            id: i,
            message: e.message || JSON.stringify(e)
        }));
    }
}
