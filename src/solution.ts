
import * as vscode from 'vscode';
import { MatchedExercise, ParsedExercise } from './types';
import { getSolutionExercises } from './export';
import { makeFlatExercises } from './readConfig';
import { getExAtCursor } from './cursor';
import { getFDocContentForExercise } from './fDocUse';

export const NEWLINE = '\n';

const GRADING_SCHEME = 'grading';

const SOLUTION_AUTH = 'solution';

const EXERCISE_AUTH = 'exercise';

const ACTIVE_SOLUTION_ID = 'active';

export function initDocProvider(): GradingDocProvider {
    const provider = new GradingDocProvider();
    vscode.workspace.registerTextDocumentContentProvider(
        GRADING_SCHEME,
        provider
    );
    return provider;
}

function makeUri(id: string | undefined, auth: string = SOLUTION_AUTH): vscode.Uri {
    id ||= '?';
    if(!id.startsWith('/')){
        id = '/' + id;
    }
    const uri = vscode.Uri.from({
        scheme: GRADING_SCHEME,
        authority: auth,
        path: id
    });
    return uri;
}

export async function showTrackingSolution(): Promise<vscode.TextEditor> {
    const uri = makeUri(ACTIVE_SOLUTION_ID);
    const doc = await vscode.workspace.openTextDocument(uri);
    return vscode.window.showTextDocument(doc);
}

export async function showSolution(id?: string): Promise<vscode.TextEditor | undefined> {
    const sols = await getSolutionExercises();
    const flatSols = makeFlatExercises(sols);
    id ||= await pickExercise();
    if(!id){
        return undefined;
    }
    let langId: string | undefined;
    let pex: ParsedExercise | undefined;
    if(id === ACTIVE_SOLUTION_ID){
        const [mex, tempPex] = getExAtCursor();
        pex = tempPex;
    } else{
        pex = flatSols.find(ex => ex.id === id)?.parsedExercises[0];
    }
    langId = pex?.document.languageId;
    const uri = makeUri(id);
    const doc = await vscode.workspace.openTextDocument(uri);
    if(langId){
        vscode.languages.setTextDocumentLanguage(doc, langId);
    }
    return vscode.window.showTextDocument(doc);
}

export async function pickExercise(includeActive = true): Promise<string | undefined> {
    const sols = await getSolutionExercises();
    const flatSols = makeFlatExercises(sols);
    const ids = flatSols.map(ex => ex.id);
    if(includeActive){
        ids.unshift(ACTIVE_SOLUTION_ID);
    }
    const id = await vscode.window.showQuickPick(ids);
    return id;
}

export async function showExercise(id?: string): Promise<vscode.TextEditor | undefined> {
    const sols = await getSolutionExercises();
    const flatSols = makeFlatExercises(sols);
    id ||= await pickExercise(false);
    if(!id){
        return undefined;
    }
    const pex = flatSols.find(ex => ex.id === id)?.parsedExercises[0];
    const langId = pex?.document.languageId;
    const uri = makeUri(id, EXERCISE_AUTH);
    const doc = await vscode.workspace.openTextDocument(uri);
    if(langId){
        vscode.languages.setTextDocumentLanguage(doc, langId);
    }
    return vscode.window.showTextDocument(doc);
}

class GradingDocProvider implements vscode.TextDocumentContentProvider {
    
    listeners: ((e: vscode.Uri) => any)[] = [];
    currentExId: string | undefined = undefined;
    
    constructor() {
        vscode.window.onDidChangeTextEditorSelection(() => this.onSelectionChange());
        vscode.window.onDidChangeActiveTextEditor(() => this.onSelectionChange());
    }
    
    onSelectionChange(): void {
        const editor = vscode.window.activeTextEditor;
        const sel = editor?.selection;
        if(!sel){
            return;
        }
        const [mex, pex] = getExAtCursor(false);
        const newExId = mex?.id;
        if(!newExId || newExId === this.currentExId){
            return;
        }
        this.currentExId = newExId;
        this.notifyListeners();
    }
    
    notifyListeners(): void {
        for(const listener of this.listeners){
            const uri = makeUri(ACTIVE_SOLUTION_ID);
            listener(uri);
        }
    }
    
    onDidChange(listener: (e: vscode.Uri) => any): vscode.Disposable {
        // vscode.Event<vscode.Uri>
        this.listeners.push(listener);
        const dispo = new vscode.Disposable(() => {
            this.listeners = this.listeners.filter(l => l !== listener);
        });
        return dispo;
    };

    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        if(uri.authority === SOLUTION_AUTH){
            return this.provideSolutionContent(uri);
        }
        if(uri.authority === EXERCISE_AUTH){
            return this.provideExerciseDocumentContent(uri);
        }
        throw new Error(`Invalid uri: ${uri.toString()}`);
    }
    
    async provideSolutionContent(uri: vscode.Uri): Promise<string> {
        const pathSegments = uri.path.split('/');
        const id = pathSegments[1];
        if(!id){
            return `Invalid request!\nUri: ${uri.toString}\nId: ${id}`;
        }
        const txt = await getStringForExId(id);
        return txt;
    }
    
    async provideExerciseDocumentContent(uri: vscode.Uri): Promise<string> {
        const pathSegments = uri.path.split('/');
        const id = pathSegments[1];
        if(!id){
            return `Invalid request!\nUri: ${uri.toString}\nId: ${id}`;
        }
        const txt = getFDocContentForExercise(id);
        return txt;
    }
}

async function getStringForExId(id: string): Promise<string> {
    const sols = await getSolutionExercises();
    const flatSols = makeFlatExercises(sols);
    if(id === ACTIVE_SOLUTION_ID){
        const [mex, pex] = getExAtCursor();
        if(!mex){
            return `No exercise selected.`;
        }
        id = mex.id;
    }
    const ex = flatSols.find(mex => mex.id === id);
    if(!ex){
        return `Exercise with id <${id}> not found.`;
    }
    return mExToString(ex);
}

function mExToString(mex: MatchedExercise, includeSubExs: boolean = true): string {
    let ret = '';
    for(const pex of mex.parsedExercises){
        ret += pex.text;
    }
    return ret;
}

