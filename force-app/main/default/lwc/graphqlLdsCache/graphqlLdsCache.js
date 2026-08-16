import { LightningElement } from 'lwc';
import { gql, executeMutation } from 'lightning/graphql';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const BADGE_OPTIONS = [
    { label: 'Attendee', value: 'Attendee' },
    { label: 'VIP', value: 'VIP' },
    { label: 'Speaker', value: 'Speaker' }
];

export default class GraphqlLdsCache extends LightningElement {
    badgeOptions = BADGE_OPTIONS;
    contactId;
    badgeType = 'Attendee';
    errors;

    // The selection set queries back the fields we just changed.
    // Lightning Data Service ingests that response and notifies every
    // subscribed adapter — the welcome screen updates with no refresh code.
    checkInMutation = gql`
        mutation checkInAttendee($input: ContactUpdateInput!) {
            uiapi {
                ContactUpdate(input: $input) {
                    Record {
                        Id
                        Checked_In__c {
                            value
                        }
                        Badge_Type__c {
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

    handleBadgeChange(event) {
        this.badgeType = event.target.value;
    }

    async handleCheckIn() {
        this.errors = undefined;
        try {
            const result = await executeMutation({
                query: this.checkInMutation,
                variables: {
                    input: {
                        Id: this.contactId,
                        Contact: {
                            Checked_In__c: true,
                            Badge_Type__c: this.badgeType
                        }
                    }
                }
            });
            if (result.errors?.length) {
                this.errors = result.errors;
            } else {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Attendee checked in',
                        message:
                            'Watch the welcome screen on the left — it updated itself via the LDS cache',
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
