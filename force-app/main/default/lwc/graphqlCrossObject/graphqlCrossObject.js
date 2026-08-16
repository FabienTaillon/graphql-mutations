import { LightningElement, wire } from 'lwc';
import { gql, graphql, executeMutation } from 'lightning/graphql';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class GraphqlCrossObject extends LightningElement {
    accountId;
    account;
    contacts;
    errors;
    refreshGraphQL;

    // One GraphQL query, two sObjects: the Account and its Contacts.
    // The query comes from a getter: while it returns undefined (no account
    // selected yet), the wire adapter doesn't execute.
    @wire(graphql, {
        query: '$accountQuery',
        variables: '$graphqlVariables'
    })
    wiredData(result) {
        const { errors, data, refresh } = result;
        if (refresh) {
            this.refreshGraphQL = refresh;
        }
        if (data) {
            const accounts = data.uiapi.query.Account.edges;
            this.account = accounts.length
                ? {
                      Id: accounts[0].node.Id,
                      Name: accounts[0].node.Name.value,
                      Rating: accounts[0].node.Rating.value
                  }
                : undefined;
            this.contacts = data.uiapi.query.Contact.edges.map((edge) => ({
                Id: edge.node.Id,
                Name: edge.node.Name.value,
                Department: edge.node.Department.value
            }));
        }
        if (errors) {
            this.errors = errors;
        }
    }

    get accountQuery() {
        if (!this.accountId) {
            return undefined;
        }
        return gql`
            query accountWithContacts($accountId: ID!) {
                uiapi {
                    query {
                        Account(where: { Id: { eq: $accountId } }, first: 1) {
                            edges {
                                node {
                                    Id
                                    Name {
                                        value
                                    }
                                    Rating {
                                        value
                                    }
                                }
                            }
                        }
                        Contact(
                            where: { AccountId: { eq: $accountId } }
                            first: 50
                        ) {
                            edges {
                                node {
                                    Id
                                    Name {
                                        value
                                    }
                                    Department {
                                        value
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `;
    }

    get graphqlVariables() {
        return { accountId: this.accountId };
    }

    get hasSelection() {
        return !!(this.accountId && this.account);
    }

    handleAccountChange(event) {
        this.account = undefined;
        this.contacts = undefined;
        this.errors = undefined;
        this.accountId = event.detail.recordId;
    }

    // One mutation document that spans TWO sObject types:
    // AccountUpdate + one ContactUpdate per child contact.
    async handleMarkStrategic() {
        this.errors = undefined;

        const variables = {
            accountInput: {
                Id: this.account.Id,
                Account: { Rating: 'Hot' }
            }
        };
        const varDefs = ['$accountInput: AccountUpdateInput!'];
        const operations = [
            'account: AccountUpdate(input: $accountInput) { success }'
        ];

        this.contacts.forEach((contact, index) => {
            variables[`contactInput${index}`] = {
                Id: contact.Id,
                Contact: { Department: 'Strategic Accounts' }
            };
            varDefs.push(`$contactInput${index}: ContactUpdateInput!`);
            operations.push(
                `contact${index}: ContactUpdate(input: $contactInput${index}) { success }`
            );
        });

        const query = gql`
            mutation markAccountStrategic(${varDefs.join(', ')}) {
                uiapi(input: { allOrNone: true }) {
                    ${operations.join('\n')}
                }
            }
        `;

        try {
            const result = await executeMutation({ query, variables });
            if (result.errors) {
                this.errors = result.errors;
            } else {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Cross-object update complete',
                        message: `1 Account + ${this.contacts.length} Contact(s) updated in a single request`,
                        variant: 'success'
                    })
                );
                await this.refreshGraphQL?.();
            }
        } catch (error) {
            this.errors = [error];
        }
    }

    get errorMessages() {
        return this.errors?.map((e, i) => ({
            id: i,
            message: e.message || JSON.stringify(e)
        }));
    }
}
