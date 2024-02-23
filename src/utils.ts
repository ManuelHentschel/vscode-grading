import * as vscode from "vscode";
import * as crypto from "crypto";
import * as types from "./types";
import { RegExpExecReplaceArray } from './readConfig';
import { TextWithRange } from "./types";


export function arraysEqual<T>(a0: T[], a1: T[]){
    if(a0.length !== a1.length){
        return false;
    }
    for (let i = 0; i < a0.length; i++) {
        if(a0[i] !== a1[i]){
            return false;
        }
    }
    return true;
}

export function arraySum(a: number[]): number {
    return a.reduce((x, y) => x + y, 0);
}

export function isDefined<T>(x: T | undefined): x is T {
    return x !== undefined;
}
export function isMDoc(x: types.MatchedDocument | undefined): x is types.MatchedDocument {
    return x !== undefined;
}

export function getCoveredRange(
    ex: types.MatchedExercise,
    includeSubExercises: boolean = false,
    rangeOption: RangeOption = 'asIs',
    doc?: vscode.TextDocument
): vscode.Range | undefined {
    let ret: vscode.Range | undefined;
    for(const pex of ex.parsedExercises){
        ret = rangeUnion(ret, pex.range);
    }
    if(includeSubExercises){
        for (const subEx of ex.subExercises) {
            const subRange = getCoveredRange(subEx);
            ret = rangeUnion(ret, subRange);
        }
    }
    if(ret && rangeOption !== 'asIs' && doc){
        ret = adjustRange(doc, ret, rangeOption);
    }
    return ret;
}

function rangeUnion(rng0?: vscode.Range, rng1?: vscode.Range): vscode.Range | undefined {
    if(!rng1){
        return rng0;
    }
    if(!rng0){
        return rng1;
    }
    return rng0.union(rng1);
}

interface RegExpExecArrayWithIndices extends RegExpExecArray {
    indices: ([number, number] | undefined)[]
}

export function execRegExp(txt: TextWithRange, re: RegExp | string): TextWithRange[][] {
    re = RegExp(re, 'gd');
    const matches = txt.text.matchAll(re) as Iterable<RegExpExecArrayWithIndices>;
    const matches2 = [...matches];
    const matches3 = matches2.map((m) => {
        return convertIndicesToRange(txt, m);
    });
    return matches3;
}

function convertIndicesToRange(txt: TextWithRange, m: RegExpExecArrayWithIndices): TextWithRange[] {
    // Ignores `undefined` indices!
    // These occur e.g. in `/(?:(a)|(b))/`
    const ind2 = m.indices.filter(ind => ind !== undefined) as [number, number][];
    const ret = ind2.map(inds => {
        const pos0 = txt.range.start.translate(0, inds[0]);
        const pos1 = txt.range.start.translate(0, inds[1]);
        const range = new vscode.Range(pos0, pos1);
        const text = txt.text.slice(inds[0], inds[1]);
        return {
            text: text,
            range: range
        };
    });
    return ret;
}


export function assertMinArrayLength<T>(arr: T[], length: 1, message?: string): [T, ...T[]];
export function assertMinArrayLength<T>(arr: T[], length: 2, message?: string): [T, T, ...T[]];
export function assertMinArrayLength<T>(arr: T[], length: 3, message?: string): [T, T, T, ...T[]];
export function assertMinArrayLength<T>(arr: T[], length: 4, message?: string): [T, T, T, T, ...T[]];
export function assertMinArrayLength<T>(arr: T[], length: 5, message?: string): [T, T, T, T, T, ...T[]];
export function assertMinArrayLength<T>(arr: T[], length: number, message = 'Array is too short!'): T[] {
    if(arr.length < length){
        throw Error(message);
    }
    return arr;
}


export type RangeOption = "asIs" | "firstLine" | "firstNonEmpty" | "lastLine" | "lastNonEmpty" | "withoutTrailing";

export function adjustRange(doc: vscode.TextDocument, range: vscode.Range, rangeOption: RangeOption): vscode.Range {
    if(rangeOption === 'asIs'){
        return range;
    }
    if(rangeOption === 'firstLine'){
        return getFirstLineRange(doc, range);
    }
    if(rangeOption === 'firstNonEmpty'){
        return getFirstLineRange(doc, range, true);
    }
    if(rangeOption === 'lastLine'){
        return getLastLineRange(doc, range);
    }
    if(rangeOption === 'lastNonEmpty'){
        return getLastLineRange(doc, range, true);
    }
    if(rangeOption === 'withoutTrailing'){
        const firstLine = getFirstLineRange(doc, range, true);
        const lastLine = getLastLineRange(doc, range, true);
        return new vscode.Range(firstLine.start, lastLine.end);
    }
    throw Error(`Unknown range option: ${rangeOption}`);
}

export function getFirstLineRange(doc: vscode.TextDocument, range: vscode.Range, skipEmpty?: boolean): vscode.Range {
    for(let line = range.start.line; line < range.end.line; line++){
        const textLine = doc.lineAt(line);
        if(!skipEmpty || !textLine.isEmptyOrWhitespace){
            return textLine.range;
        }
    }
    return doc.lineAt(range.start.line).range;
}
export function getLastLineRange(doc: vscode.TextDocument, range: vscode.Range, skipEmpty?: boolean): vscode.Range {
    if (!skipEmpty) {
        return doc.lineAt(range.end.line).range;
    }
    for (let line = range.end.line; line > range.start.line; line--) {
        const textLine = doc.lineAt(line);
        if (!textLine.isEmptyOrWhitespace) {
            return textLine.range;
        }
    }
    return doc.lineAt(range.start.line).range;
}

export function getUniqueEntries<T>(arr: T[]): T[] {
    return arr.filter((value, index, self) => self.indexOf(value) === index);
}


export function computeHashForDoc(doc: vscode.TextDocument): string {
    return computeHash(doc.getText());
}

export function computeHash(...args: string[]): string {
    const hash = crypto.createHash('md5');
    for(const arg of args){
        hash.update(arg);
    }
    return hash.digest('hex');
}


export function deepCopy<T>(x0: T): T {
    if(typeof x0 !== 'object'){
        return x0;
    }
    if(Array.isArray(x0)){
        return x0.map(deepCopy) as T;
    }
    const x1 = Object.create(Object.getPrototypeOf(x0));
    for(const key in x0){
        x1[key] = deepCopy(x0[key]);
    }
    return x1 as T;
}


