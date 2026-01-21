import { FormArray, FormGroup, ValidatorFn } from '@angular/forms';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { EsploroFields } from './esploro-fields'
import { isEmptyString } from '../utilities';

export const mandatoryFieldsAdd = [
  {header: 'primary_id', fieldName: 'primary_id'},
  {header: 'auto_capture', fieldName: 'researcher.auto_capture'},
  {header: 'default_publication_language', fieldName: 'researcher.default_publication_language.value'},
  {header: 'portal_profile', fieldName: 'researcher.portal_profile.value'},
  {header: 'researcher_last_name', fieldName: 'researcher.researcher_last_name'},
  {header: 'research_center', fieldName: 'researcher.research_center'}
];
export const mandatoryFieldsUpdate = [{header: 'primary_id', fieldName: 'primary_id'}];

/** Validate appropriate combination of fields for CSV import profile */
export const validateFields = (fields: FormArray): string[] | null => {
  let errorArray = [];

  /** Mandatory fields (always required) */
  /* primary_id required */
  if (!fields.value.some(f=>f['fieldName']=='primary_id')) {
    errorArray.push({code:_('Settings.Validation.PrimaryIdRequired')});
  }

  /** Mandatory fields for groups */
  /* Current internal affiliation - organization code required */
  if (fields.value.some(f=>f['fieldName'].startsWith('researcher.researcher_organization_affiliation'))
    && !fields.value.some(f=>f['fieldName']=='researcher.researcher_organization_affiliation[].organization_code'))
    errorArray.push({code:_('Settings.Validation.CurIntAffiliationOrgaRequired')});

  /* Previous internal affiliation - organization code required */
  if (fields.value.some(f=>f['fieldName'].startsWith('researcher.researcher_previous_organization_affiliation'))
    && !fields.value.some(f=>f['fieldName']=='researcher.researcher_previous_organization_affiliation[].organization_code'))
    errorArray.push({code:_('Settings.Validation.PrevIntAffiliationOrgaRequired')});
  
  /* Current external affiliation - organization code required */
  if (fields.value.some(f=>f['fieldName'].startsWith('researcher.researcher_external_organization_affiliation'))
    && !fields.value.some(f=>f['fieldName']=='researcher.researcher_external_organization_affiliation[].organization_code'))
    errorArray.push({code:_('Settings.Validation.CurExtAffiliationOrgaRequired')});

  /* Previous external affiliation - organization code required */
  if (fields.value.some(f=>f['fieldName'].startsWith('researcher.researcher_previous_external_organization_affiliation'))
    && !fields.value.some(f=>f['fieldName']=='researcher.researcher_previous_external_organization_affiliation[].organization_code'))
    errorArray.push({code:_('Settings.Validation.PrevExtAffiliationOrgaRequired')});
  
  /* Engagements - type required */
  if (fields.value.some(f=>f['fieldName'].startsWith('researcher.researcher_engagement_type'))
    && !fields.value.some(f=>f['fieldName']=='researcher.researcher_engagement_type[].researcher_engagement.value'))
    errorArray.push({code:_('Settings.Validation.EngagementsTypeRequired')});

  /* Educations - organization code required */
  if (fields.value.some(f=>f['fieldName'].startsWith('researcher.researcher_education'))
    && !fields.value.some(f=>f['fieldName']=='researcher.researcher_education[].organization_code'))
    errorArray.push({code:_('Settings.Validation.EducationsOrgaRequired')});
  
  /* Honors - organization code required */
  if (fields.value.some(f=>f['fieldName'].startsWith('researcher.researcher_honor'))
    && !fields.value.some(f=>f['fieldName']=='researcher.researcher_honor[].organization_code'))
    errorArray.push({code:_('Settings.Validation.HonorsOrgaRequired')});

  /* Identifiers - type and value required */
  if (fields.value.some(f=>f['fieldName'].startsWith('researcher.user_identifier'))
    && (!fields.value.some(f=>f['fieldName']=='researcher.user_identifier[].value')
      || !fields.value.some(f=>f['fieldName']=='researcher.user_identifier[].id_type.value')))
    errorArray.push({code:_('Settings.Validation.IdentifiersTypeAndValueRequired')});
  
  /* Name variants - last name required */
  if (fields.value.some(f=>f['fieldName'].startsWith('researcher.researcher_name_variant'))
    && !fields.value.some(f=>f['fieldName']=='researcher.researcher_name_variant[].last_name')) 
    errorArray.push({code:_('Settings.Validation.NameVariantsLastNameRequired')});

  /* Webpages - type and url required */
  if (fields.value.some(f=>f['fieldName'].startsWith('researcher.researcher_webpage'))
    && (!fields.value.some(f=>f['fieldName']=='researcher.researcher_webpage[].type')
      || !fields.value.some(f=>f['fieldName']=='researcher.researcher_webpage[].url')))
    errorArray.push({code:_('Settings.Validation.WebpagesTypeAndUrlRequired')});

  /* Multilingual fields - language required */
  const multilingualFields = fields.value.filter(f => f['fieldName'] && f['fieldName'].includes('_multilingual'));
  multilingualFields.forEach(field => {
    if (!field['language'] || field['language'] === '') {
      errorArray.push({code:_('Settings.Validation.MultilingualLanguageRequired')});
    }
  });

  return errorArray.length>0 ? errorArray : null;
}

/** Validate entire form */
export function validateForm(translate: TranslateService): ValidatorFn {
  return (form: FormGroup) : string[] | null => {
    let errorArray = [];
    let profiles = form.get('profiles') as FormArray;

    /* General validations */
    profiles.controls.forEach( p => {
      let fields = p.get('fields');
      /* All fields must have a fieldName and either a default or a header */
      if ( fields.value.some(f=>!f['fieldName']))
        errorArray.push({code:_('Settings.Validation.FieldNameRequired'), params:{profile:p.get('name').value}})
      if ( fields.value.some(f=>!f['header'] && !f['default']))
        errorArray.push({code:_('Settings.Validation.HeaderRequired'), params:{profile:p.get('name').value}})
      /* There must be a primary ID field */
      if ( !fields.value.some(f=>f['fieldName']=='primary_id'))
        errorArray.push({code:_('Settings.Validation.PrimaryIdRequired'), params:{profile:p.get('name').value}})
    })

    /* If profile_type = ADD, certain fields are required by researcher api */
    const esploroFields = EsploroFields.getInstance();
    const reqFieldErrorLabelKey = 'Settings.Validation.FieldRequired';
    
    profiles.controls.forEach( p => {
      if (['ADD'].includes(p.get('profileType').value)) {
        const fields = p.get('fields');
        
        mandatoryFieldsAdd.forEach(currentField => {
          if (!(fields.value.some(f=>f['fieldName'] == currentField.fieldName))) {
            let fieldLabelKey = esploroFields.getLabelKeyByFieldKey(currentField.fieldName);
            let groupLabelKey = esploroFields.getFieldGroupNameByFieldKey(currentField.fieldName);
            translate.get([fieldLabelKey, groupLabelKey]).subscribe(translations => {
              let fieldLabel = translations[fieldLabelKey];
              let groupLabel = translations[groupLabelKey];

              if (!isEmptyString(fieldLabel) && !isEmptyString(groupLabel)) {
                errorArray.push({code: _(reqFieldErrorLabelKey), params:{fieldname: fieldLabel, groupname: groupLabel}});
              } else {
                errorArray.push({code: _(reqFieldErrorLabelKey), params:{fieldname: currentField.fieldName}});
              }
            });
          }
        })
      }
    })

    return errorArray.length>0 ? errorArray : null;
  };
}