import { LightningElement, wire } from 'lwc';
import { gql, graphql, executeMutation } from 'lightning/graphql';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class GraphqlCrossObject extends LightningElement {
    accountId;
    account;
    contacts;
    errors;
    refreshGraphQL;

    // One GraphQL query, two sObjects: the sponsor Account and its attendees.
    // The query comes from a getter: while it returns undefined (no sponsor
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
                      SponsorTier: accounts[0].node.Sponsor_Tier__c.value
                  }
                : undefined;
            this.contacts = data.uiapi.query.Contact.edges.map((edge) => ({
                Id: edge.node.Id,
                Name: edge.node.Name.value,
                BadgeType: edge.node.Badge_Type__c.value
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
            query sponsorWithAttendees($accountId: ID!) {
                uiapi {
                    query {
                        Account(where: { Id: { eq: $accountId } }, first: 1) {
                            edges {
                                node {
                                    Id
                                    Name {
                                        value
                                    }
                                    Sponsor_Tier__c {
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
                                    Badge_Type__c {
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
    // AccountUpdate + one ContactUpdate per attendee.
    async handleUpgradeToGold() {
        this.errors = undefined;

        const variables = {
            accountInput: {
                Id: this.account.Id,
                Account: { Sponsor_Tier__c: 'Gold' }
            }
        };
        const varDefs = ['$accountInput: AccountUpdateInput!'];
        const operations = [
            'account: AccountUpdate(input: $accountInput) { success }'
        ];

        this.contacts.forEach((contact, index) => {
            variables[`contactInput${index}`] = {
                Id: contact.Id,
                Contact: { Badge_Type__c: 'VIP' }
            };
            varDefs.push(`$contactInput${index}: ContactUpdateInput!`);
            operations.push(
                `contact${index}: ContactUpdate(input: $contactInput${index}) { success }`
            );
        });

        const query = gql`
            mutation upgradeSponsorToGold(${varDefs.join(', ')}) {
                uiapi(input: { allOrNone: true }) {
                    ${operations.join('\n')}
                }
            }
        `;

        try {
            const result = await executeMutation({ query, variables });
            if (result.errors?.length) {
                this.errors = result.errors;
            } else {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Sponsor upgraded',
                        message: `1 sponsor Account + ${this.contacts.length} attendee badge(s) upgraded in a single request`,
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
