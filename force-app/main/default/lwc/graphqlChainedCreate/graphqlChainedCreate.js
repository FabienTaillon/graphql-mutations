import { LightningElement } from 'lwc';
import { gql, executeMutation } from 'lightning/graphql';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class GraphqlChainedCreate extends LightningElement {
    accountName = '';
    contactRows = [
        { key: 1, firstName: '', lastName: '' },
        { key: 2, firstName: '', lastName: '' }
    ];
    nextKey = 3;
    createdAccountId;
    errors;
    isLoading = false;

    handleAccountNameChange(event) {
        this.accountName = event.target.value;
    }

    handleContactChange(event) {
        const key = Number(event.target.dataset.key);
        const field = event.target.dataset.field;
        this.contactRows = this.contactRows.map((row) =>
            row.key === key ? { ...row, [field]: event.target.value } : row
        );
    }

    handleAddContact() {
        this.contactRows = [
            ...this.contactRows,
            { key: this.nextKey++, firstName: '', lastName: '' }
        ];
    }

    handleRemoveContact(event) {
        const key = Number(event.target.dataset.key);
        this.contactRows = this.contactRows.filter((row) => row.key !== key);
    }

    // One atomic request: AccountCreate, then one ContactCreate per row.
    // Each contact's AccountId is "@{account}" — a chained field reference
    // resolved server-side to the Id of the account created just above.
    async handleCreate() {
        this.errors = undefined;
        this.createdAccountId = undefined;

        const rows = this.contactRows.filter((row) => row.lastName);
        if (!this.accountName) {
            this.errors = [{ message: 'Account Name is required' }];
            return;
        }
        this.isLoading = true;

        const variables = {
            accountInput: {
                Account: { Name: this.accountName, Sponsor_Tier__c: 'Bronze' }
            }
        };
        const varDefs = ['$accountInput: AccountCreateInput!'];
        const operations = [
            `account: AccountCreate(input: $accountInput) {
                Record { Id Name { value } }
            }`
        ];

        rows.forEach((row, index) => {
            variables[`contactInput${index}`] = {
                Contact: {
                    FirstName: row.firstName,
                    LastName: row.lastName,
                    Badge_Type__c: 'Attendee',
                    AccountId: '@{account}'
                }
            };
            varDefs.push(`$contactInput${index}: ContactCreateInput!`);
            operations.push(
                `contact${index}: ContactCreate(input: $contactInput${index}) { Record { Id } }`
            );
        });

        const query = gql`
            mutation createAccountWithContacts(${varDefs.join(', ')}) {
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
                const account = result.data.uiapi.account.Record;
                this.createdAccountId = account.Id;
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Chained create complete',
                        message: `${account.Name.value} (Bronze sponsor) + ${rows.length} attendee(s) registered and linked in 1 atomic request`,
                        variant: 'success'
                    })
                );
                this.accountName = '';
                this.contactRows = [
                    { key: this.nextKey++, firstName: '', lastName: '' },
                    { key: this.nextKey++, firstName: '', lastName: '' }
                ];
            }
        } catch (error) {
            this.errors = [error];
        } finally {
            this.isLoading = false;
        }
    }

    get accountUrl() {
        return `/lightning/r/Account/${this.createdAccountId}/view`;
    }

    get errorMessages() {
        return this.errors?.map((e, i) => ({
            id: i,
            message: e.message || JSON.stringify(e)
        }));
    }
}
