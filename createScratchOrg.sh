#!/bin/bash
echo '##### CREATING SCRATCH ORG #####'
SCRATCH_ALIAS=$1
PROJECT_NAME=${PWD##*/}
SCRATCH_ALIAS="${SCRATCH_ALIAS:-$PROJECT_NAME-`git branch | grep \* | cut -d ' ' -f2`}"
sf org create scratch --definition-file config/project-scratch-def.json --alias $SCRATCH_ALIAS --wait 15 --set-default
echo '##### PUSHING METADATA #####'
sf project deploy start --ignore-conflicts --target-org $SCRATCH_ALIAS
echo '##### ASSIGNING PERMISSIONS #####'
sf org assign permset --name GraphQL_Mutations_Demo --target-org $SCRATCH_ALIAS
echo '##### IMPORTING DUMMY DATA #####'
sf data import tree --plan data/Account-Contact-plan.json --target-org $SCRATCH_ALIAS
# Optional: only when texei-sfdx-plugin is installed
if sf plugins 2>/dev/null | grep -q texei-sfdx-plugin; then
  echo '##### CLEANING STANDARD LAYOUTS #####'
  sf texei source layouts cleanorg --target-org $SCRATCH_ALIAS
fi
echo '##### CLEANING TRACKING #####'
sf project reset tracking --no-prompt --target-org $SCRATCH_ALIAS
echo '##### OPENING SCRATCH ORG #####'
sf org open --path /lightning/n/GraphQL_Mutations_Demo --target-org $SCRATCH_ALIAS
