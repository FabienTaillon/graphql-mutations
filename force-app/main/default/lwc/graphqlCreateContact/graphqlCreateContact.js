import { LightningElement, wire } from 'lwc';
import { gql, graphql, executeMutation } from 'lightning/graphql';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const BADGE_OPTIONS = [
    { label: 'Attendee', value: 'Attendee' },
    { label: 'VIP', value: 'VIP' },
    { label: 'Speaker', value: 'Speaker' }
];

export default class GraphqlCreateContact extends LightningElement {
    badgeOptions = BADGE_OPTIONS;
    firstName = '';
    lastName = '';
    email = '';
    badgeType = 'Attendee';
    attendees;
    errors;
    isLoading = false;
    refreshGraphQL;

    // A regular GraphQL query: the 5 most recent registrations.
    // The wire result exposes a refresh() function we call after the mutation.
    @wire(graphql, {
        query: gql`
            query recentRegistrations {
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
                                    Badge_Type__c {
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
    wiredAttendees(result) {
        const { errors, data, refresh } = result;
        if (refresh) {
            this.refreshGraphQL = refresh;
        }
        if (data) {
            this.attendees = data.uiapi.query.Contact.edges.map((edge) => ({
                Id: edge.node.Id,
                Name: edge.node.Name.value,
                BadgeType: edge.node.Badge_Type__c.value,
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
        mutation registerAttendee($input: ContactCreateInput!) {
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

    async handleRegister() {
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
                            Email: this.email,
                            Badge_Type__c: this.badgeType
                        }
                    }
                }
            });

            if (result.errors?.length) {
                this.errors = result.errors;
            } else {
                const record = result.data.uiapi.ContactCreate.Record;
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Attendee registered',
                        message: `${record.Name.value} — badge ready to print`,
                        variant: 'success'
                    })
                );
                this.firstName = '';
                this.lastName = '';
                this.email = '';
                this.badgeType = 'Attendee';
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
