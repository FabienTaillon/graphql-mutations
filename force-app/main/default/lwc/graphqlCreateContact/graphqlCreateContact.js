import { LightningElement, wire } from 'lwc';
import { gql, graphql, executeMutation } from 'lightning/graphql';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class GraphqlCreateContact extends LightningElement {
    firstName = '';
    lastName = '';
    title = '';
    email = '';
    contacts;
    errors;
    isLoading = false;
    refreshGraphQL;

    // A regular GraphQL query: the 5 most recently created contacts.
    // The wire result exposes a refresh() function we call after the mutation.
    @wire(graphql, {
        query: gql`
            query recentContacts {
                uiapi {
                    query {
                        Contact(
                            first: 5
                            orderBy: { CreatedDate: { order: DESC } }
                        ) {
                            edges {
                                node {
                                    Id
                                    Name {
                                        value
                                    }
                                    Title {
                                        value
                                    }
                                    Email {
                                        value
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
                Name: edge.node.Name.value,
                Title: edge.node.Title.value,
                Email: edge.node.Email.value
            }));
        }
        if (errors) {
            this.errors = errors;
        }
    }

    // The mutation is static: values are passed as typed GraphQL variables,
    // never concatenated into the query string.
    createMutation = gql`
        mutation createContact($input: ContactCreateInput!) {
            uiapi {
                ContactCreate(input: $input) {
                    Record {
                        Id
                        Name {
                            value
                        }
                    }
                }
            }
        }
    `;

    handleChange(event) {
        this[event.target.dataset.field] = event.target.value;
    }

    async handleCreate() {
        if (!this.lastName) {
            this.errors = [{ message: 'Last Name is required' }];
            return;
        }
        this.isLoading = true;
        this.errors = undefined;

        try {
            const result = await executeMutation({
                query: this.createMutation,
                variables: {
                    input: {
                        Contact: {
                            FirstName: this.firstName,
                            LastName: this.lastName,
                            Title: this.title,
                            Email: this.email
                        }
                    }
                }
            });

            if (result.errors) {
                this.errors = result.errors;
            } else {
                const record = result.data.uiapi.ContactCreate.Record;
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Contact created',
                        message: `${record.Name.value} (${record.Id})`,
                        variant: 'success'
                    })
                );
                this.firstName = '';
                this.lastName = '';
                this.title = '';
                this.email = '';
                await this.refreshGraphQL?.();
            }
        } catch (error) {
            this.errors = [error];
        } finally {
            this.isLoading = false;
        }
    }

    get errorMessages() {
        return this.errors?.map((e, i) => ({
            id: i,
            message: e.message || JSON.stringify(e)
        }));
    }
}
