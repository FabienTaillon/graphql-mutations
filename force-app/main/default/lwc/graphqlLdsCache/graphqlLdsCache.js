import { LightningElement } from 'lwc';
import { gql, executeMutation } from 'lightning/graphql';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class GraphqlLdsCache extends LightningElement {
    contactId;
    phone = '';
    title = '';
    errors;

    // The selection set queries back the fields we just changed.
    // Lightning Data Service ingests that response and notifies every
    // subscribed adapter — the record form updates with no refresh code.
    updateMutation = gql`
        mutation updateContact($input: ContactUpdateInput!) {
            uiapi {
                ContactUpdate(input: $input) {
                    Record {
                        Id
                        Phone {
                            value
                        }
                        Title {
                            value
                        }
                    }
                }
            }
        }
    `;

    handleContactChange(event) {
        this.contactId = event.detail.recordId;
        this.errors = undefined;
    }

    handleChange(event) {
        this[event.target.dataset.field] = event.target.value;
    }

    async handleUpdate() {
        this.errors = undefined;
        try {
            const result = await executeMutation({
                query: this.updateMutation,
                variables: {
                    input: {
                        Id: this.contactId,
                        Contact: {
                            Phone: this.phone,
                            Title: this.title
                        }
                    }
                }
            });
            if (result.errors) {
                this.errors = result.errors;
            } else {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Mutation executed',
                        message:
                            'Watch the record form on the left — it updated itself via the LDS cache',
                        variant: 'success'
                    })
                );
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
