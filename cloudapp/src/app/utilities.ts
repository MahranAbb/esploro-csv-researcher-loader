import { UserIdentifier } from "./models/researcher";

/** Maps object based on passed in function and returns object */
const mapObject = (object: Object, mapFn: Function) => Object.keys(object).reduce(function(result, key) {
    result[key] = mapFn(object[key])
    return result
  }, {});

/** Chunks array and returns array of arrays of specified size */
const chunk = <T>(inputArray: Array<T>, size:number): Array<Array<T>> => {
  return inputArray.reduce((all,one,i) => {
    const ch = Math.floor(i/size); 
    all[ch] = [].concat((all[ch]||[]),one); 
    return all;
  }, []);
};

/** Asynchronously executes the function for each element in the array */
const asyncForEach = async <T>(array: T[], callback: (item: T, i: number, a: T[]) => Promise<any>) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};

/** Checks if object is empty */
const isEmptyObject = (obj: Object) => Object.keys(obj).length === 0 && obj.constructor === Object;

/** Checks if a string is empty */
const isEmptyString = (value: string | null | undefined): boolean => {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }
  return false;
};

/** Handles either resolved or rejected Promise */
const reflect = p => p.then(v => ({v, status: "fulfilled" }), e => ({e, status: "rejected" }));

/** Downloads file */
const download = (filename: string, filetype: string, contents: string) => {
  var element = document.createElement('a');
  element.setAttribute('href', `data:${filetype};charset=utf-8,` + encodeURIComponent(contents));
  element.setAttribute('download', `${filename}`);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

/** Safe JSON parse */
const tryParse = (val: string) => {
  try {
    return JSON.parse(val);
  } catch(e) {
    return null;
  }
};

/** 
 * Merge properties of source object to target including nested objects .
 * Special handling for researcher.user_identifiers (merge instead of swap all).
 */
const deepMergeObjects = (
  target: any, 
  source: any,
  path: string[] = []
): any => {
  if (!isObject(target) || !isObject(source)) return target;

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];
    const nextPath = [...path, key];
    const fullPath = nextPath.join('.');

    // special handling for researcher.user_identifiers
    if (fullPath === 'researcher.user_identifier') {
      target[key] = mergeUserIdentifiers(
        Array.isArray(targetValue) ? targetValue : [],
        Array.isArray(sourceValue) ? sourceValue : [],
      );
      continue;
    }

    // default handling (replace scalars and arrays)
    if (isObject(sourceValue)) {
      if (!isObject(targetValue)) target[key] = {};
      deepMergeObjects(target[key], sourceValue, nextPath);
    } else {
      target[key] = sourceValue;
    }
  }
  return target;
};

const isObject = (item: any) => {
  return item && typeof item === 'object' && !Array.isArray(item);
};

/**
 * Build a unique key for a user identifier.
 * Currently only using the id_type.value.
 */
const uidKey = (uid: UserIdentifier) =>
  `${(uid?.id_type?.value ?? '').trim().toLowerCase()}`;

/**
 * Merge two arrays of user identifiers:
 * - preserve target's existing identifiers that are not provided in source
 * - append new identifier types from source that aren't present in target
 * - replace existing identifier types in target that got new values from source
 * (if there are duplicate identifer types in Esploro, only the first identifier will be updated with new values from source)
 */
const mergeUserIdentifiers = (
  targetList: UserIdentifier[] | undefined,
  sourceList: UserIdentifier[] | undefined,
): UserIdentifier[] => {
  const result: UserIdentifier[] = Array.isArray(targetList) ? [...targetList] : [];
  if (!Array.isArray(sourceList) || sourceList.length === 0) return result;

  const firstIndexByType = new Map<string, number>();
  for (let i = 0; i < result.length; i++) {
    const idKey = uidKey(result[i]);
    if (!firstIndexByType.has(idKey)) {
      firstIndexByType.set(idKey, i);
    }

  }

  for (const uid of sourceList) {
    const idKey = uidKey(uid);
    const existingIdx = firstIndexByType.get(idKey);
    if (existingIdx == null) {
      // append
      firstIndexByType.set(idKey, result.length);
      result.push(uid);
    } else {
      // replace (source wins)
      result[existingIdx] = uid;
    }
  }
  return result;
};

const enum CustomResponseType {
  info,
  warn,
  error
};

interface CustomResponse {
  message: string;
  type: CustomResponseType;
};

export { mapObject, chunk, asyncForEach, isEmptyObject, isEmptyString, reflect, download, tryParse, deepMergeObjects, CustomResponse, CustomResponseType };