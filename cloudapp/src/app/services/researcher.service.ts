import { Injectable } from '@angular/core';
import { Observable } from 'rxjs'
import * as dot from 'dot-object';
import { CloudAppRestService, HttpMethod } from '@exlibris/exl-cloudapp-angular-lib';
import { Researcher } from '../models/researcher';
import { Profile } from '../models/settings';



@Injectable({
  providedIn: 'root'
})
export class ResearcherService {

  constructor( 
    private restService: CloudAppRestService
   ) { }

  /** (PUT) Update researcher via Esploro API */
  updateResearcher(researcher: Researcher): Observable<Researcher> {
    return this.restService.call( {
      url: `/esploro/v1/researchers/${researcher.primary_id}`,
      headers: { 
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json" 
      },
      requestBody: researcher,
      method: HttpMethod.PUT
    })
  }

  /** (GET) Fetch researcher from Esploro API */
  getResearcherByPrimaryId(primary_id: string): Observable<Researcher> {
    return this.restService.call( {
      url: `/esploro/v1/researchers/${primary_id}`,
      headers: { 
        "Content-Type": "application/json",
        Accept: "application/json" 
      },
    })
  }

  /** (GET) Fetch user from Alma API */
  getUserByPrimaryId(primary_id: string): Observable<Researcher> {
    return this.restService.call( {
      url: `/users/${primary_id}`,
      headers: { 
        "Content-Type": "application/json",
        Accept: "application/json" 
      },
    })
  }

  mapResearcher = (parsedResearcher: any, selectedProfile: Profile) => {
    const arrayIndicator = new RegExp(/\[\d*\]/);

    /**
     * Get the highest parent array index for a given base path
     * @param parentBase Base path without array notation (e.g., "researcher.researcher_webpage")
     * @param mappedFields Current mapped fields object
     * @returns Highest index found, or -1 if none exist
     */
    const getMaxParentIndex = (parentBase: string, mappedFields: any): number => {
      const parentArrayFields = Object.keys(mappedFields).filter(k => k.startsWith(parentBase + '['));
      const parentIndices = parentArrayFields.map(k => {
        const match = k.match(new RegExp(`^${parentBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\[(\\d+)\\]`));
        return match ? parseInt(match[1]) : -1;
      });
      return parentIndices.length > 0 ? Math.max(...parentIndices) : -1;
    };

    /**
     * Get existing languages for a parent array item's multilingual field
     * @param parentPath Full path to parent item's multilingual field (e.g., "researcher.researcher_webpage[0].title_multilingual")
     * @param mappedFields Current mapped fields object
     * @returns Array of language codes already present
     */
    const getExistingLanguages = (parentPath: string, mappedFields: any): string[] => {
      return Object.keys(mappedFields)
        .filter(k => k.startsWith(parentPath + '[') && k.endsWith('.language'))
        .map(k => mappedFields[k]);
    };

    /**
     * Find the index of an existing language in a multilingual array, or -1 if not found
     * @param parentPath Full path to parent item's multilingual field
     * @param language Language code to search for
     * @param mappedFields Current mapped fields object
     * @returns Index of the language, or -1 if not found
     */
    const findLanguageIndex = (parentPath: string, language: string, mappedFields: any): number => {
      const languageKeys = Object.keys(mappedFields)
        .filter(k => k.startsWith(parentPath + '[') && k.endsWith('.language'));
      
      for (const key of languageKeys) {
        if (mappedFields[key] === language) {
          const match = key.match(/\[(\d+)\]\.language$/);
          return match ? parseInt(match[1]) : -1;
        }
      }
      return -1;
    };

    const mapCsvToProfileFields = (parsedResearcher: any, selectedProfile: Profile) => {
      // Track multilingual indices for fields without parent arrays
      const multilingualIndices: { [baseField: string]: number } = {};
      
      return Object.entries<string>(parsedResearcher).reduce((mappedFields, [csvKey, csvValue]) => {
        const profileField = selectedProfile.fields.find(pf => pf.header === csvKey);
        if (!profileField?.fieldName) return mappedFields;

        let fieldName = profileField.fieldName;
        const isArrayField = arrayIndicator.test(fieldName);
        const isMultilingualField = fieldName.includes('_multilingual');

        if (isArrayField) {
          const baseFieldName = fieldName.replace(arrayIndicator, '[]');
          
          // For multilingual fields, handle them specially to group by language
          if (isMultilingualField && profileField.language) {
            // Match patterns with parent array and multilingual array:
            // researcher.researcher_webpage[].title_multilingual[].value
            const pattern = fieldName.match(/(.*?)(\[\])(\..*_multilingual)(\[\])(\.value|\.values)/);
            
            if (pattern) {
              // Has parent array - add to most recent parent item
              const parentBase = pattern[1];
              const multilingualPath = pattern[3];
              const valuePath = pattern[5];
              
              const maxParentIndex = getMaxParentIndex(parentBase, mappedFields);
              const parentIndex = maxParentIndex >= 0 ? maxParentIndex : 0;
              
              // Check if this language already exists in the current parent item
              const existingParentPath = `${parentBase}[${parentIndex}]${multilingualPath}`;
              const existingLangIndex = findLanguageIndex(existingParentPath, profileField.language, mappedFields);
              
              let multilingualIndex: number;
              if (existingLangIndex >= 0) {
                // Language exists - override it
                multilingualIndex = existingLangIndex;
              } else {
                // New language - add it
                const existingLanguages = getExistingLanguages(existingParentPath, mappedFields);
                multilingualIndex = existingLanguages.length;
              }
              
              fieldName = `${parentBase}[${parentIndex}]${multilingualPath}[${multilingualIndex}]${valuePath}`;
              const languageFieldName = `${parentBase}[${parentIndex}]${multilingualPath}[${multilingualIndex}].language`;
              mappedFields[languageFieldName] = profileField.language;
            } else {
              // Pattern without parent array - check if it's a values array or simple value field
              if (fieldName.includes('[].values')) {
                // Values array field: group multiple entries by language into a single values array
                // Example: researcher.researcher_keyword_multilingual[].values
                // Skip if csvValue is empty to allow default values to be applied
                if (!csvValue) {
                  return mappedFields;
                }
                
                const valuesPattern = fieldName.match(/(.*)(\..*_multilingual)(\[\])\.values/);
                const basePath = `${valuesPattern[1]}${valuesPattern[2]}`;
                const language = profileField.language;
                
                // Find existing index for this language, or count existing entries
                const languageKeys = Object.keys(mappedFields).filter(k => k.startsWith(basePath + '[') && k.endsWith('].language'));
                const existingKey = languageKeys.find(k => mappedFields[k] === language);
                const index = existingKey ? parseInt(existingKey.match(/\[(\d+)\]/)[1]) : languageKeys.length;
                
                // Initialize if new language
                if (!existingKey) {
                  mappedFields[`${basePath}[${index}].language`] = language;
                  mappedFields[`${basePath}[${index}].values`] = [];
                }
                
                // Add value to the values array
                mappedFields[`${basePath}[${index}].values`].push(csvValue);
                
                return mappedFields; // Skip normal processing
              } else if (fieldName.includes('[].value')) {
                // Simple value field: each language creates a separate array entry
                // Example: researcher.display_title_multilingual[].value
                const valuePattern = fieldName.match(/(.*)(\..*_multilingual)(\[\])\.value/);
                const basePath = `${valuePattern[1]}${valuePattern[2]}`;
                
                if (multilingualIndices[basePath] === undefined) {
                  multilingualIndices[basePath] = 0;
                }
                
                const multilingualIndex = multilingualIndices[basePath];
                fieldName = `${basePath}[${multilingualIndex}].value`;
                const languageFieldName = `${basePath}[${multilingualIndex}].language`;
                mappedFields[languageFieldName] = profileField.language;
                
                multilingualIndices[basePath]++;
              }
            }
          } else {
            // Non-multilingual array field - use original counting logic per field type
            const nextIndex = Object.keys(mappedFields)
              .filter(k => k.replace(arrayIndicator, '[]') === baseFieldName)
              .length;
            fieldName = fieldName.replace(arrayIndicator, `[${nextIndex}]`);
          }
        }

        if (isArrayField || csvValue) {
          mappedFields[fieldName] = ['true', 'false'].includes(csvValue) ? (csvValue === 'true') : csvValue;
        }

        return mappedFields;
      }, {});
    };

    const setDefaultValues = (researcher: any, selectedProfile: Profile) => {
      selectedProfile.fields.filter(field => field.default).forEach(field => {
        let fieldName = field.fieldName;
        const isArrayField = arrayIndicator.test(fieldName);

        if (isArrayField) {
          const isNestedArray = (fieldName.match(/\[\]/g) || []).length >= 2;
          // e.g. researcher.researcher_webpage[].title_multilingual[].value
          const nestedMatch = isNestedArray && fieldName.match(/^(.*?)\[\]\.(.*?)\[\]\.(value|values)$/);

          if (nestedMatch) {
            // Parent array + multilingual array: attach to the most recently mapped
            // parent entry, and reuse/append the language entry within it.
            const [, parentBase, multilingualBase, valuePath] = nestedMatch;
            const parentIndex = Math.max(getMaxParentIndex(parentBase, researcher), 0);
            const multilingualPath = `${parentBase}[${parentIndex}].${multilingualBase}`;

            const existingLangIndex = field.language ? findLanguageIndex(multilingualPath, field.language, researcher) : -1;
            const multilingualIndex = existingLangIndex >= 0
              ? existingLangIndex
              : getExistingLanguages(multilingualPath, researcher).length;

            fieldName = `${multilingualPath}[${multilingualIndex}].${valuePath}`;
          } else {
            // Count existing entries (from CSV mapping or earlier defaults) so the
            // default is appended as a new array entry instead of overwriting index 0.
            const nextIndex = Object.keys(researcher)
              .filter(k => k.replace(arrayIndicator, '[]') === fieldName)
              .length;
            fieldName = fieldName.replace(arrayIndicator, `[${nextIndex}]`);
          }
        }

        if (!researcher[fieldName]) {
          researcher[fieldName] = fieldName.endsWith('.values') ? [field.default] : field.default;

          // Multilingual value/values fields need their sibling .language key set alongside the default
          if (field.language) {
            const languageFieldName = fieldName.replace(/\.(value|values)$/, '.language');
            if (!researcher[languageFieldName]) {
              researcher[languageFieldName] = field.language;
            }
          }
        }
      });
    };

    let mappedResearcher = mapCsvToProfileFields(parsedResearcher, selectedProfile);
    setDefaultValues(mappedResearcher, selectedProfile);
    
    mappedResearcher = dot.object(mappedResearcher);

    return mappedResearcher;
  }
}