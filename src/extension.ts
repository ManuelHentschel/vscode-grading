// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { parseAllFilesToCsvFile, parseAllFilesToJsonFile } from './export';
import { openWebview } from './webview';
import { addPointsCommentsForAll, normalizePointsForActive, normalizePointsForAll } from './modifyDocs';
import { getDocTracker } from './docTracker';
import { registerCodeLens } from './codeLens';
import { changePointsAtCursor, incrementAtCursor } from './cursor';
import { initDocProvider, showExercise, showSolution } from './solution';
import { appendComment, changeLine } from './comments';

let extensionContext: vscode.ExtensionContext | undefined = undefined;
export function getContext(): vscode.ExtensionContext {
	if(!extensionContext){
		throw new Error('No extension context!');
	}
	return extensionContext;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	extensionContext = context;
	
	getDocTracker();

	registerCodeLens();
	
	initDocProvider();
	
	vscode.commands.registerCommand('vscode-grading.showSolution', () => {
		showSolution();
	});
	
	vscode.commands.registerCommand('vscode-grading.showExercise', () => {
		showExercise();
	});


	vscode.commands.registerCommand('vscode-grading.formatAllOpen', async () => {
		await formatAll();
	});
	
	vscode.commands.registerCommand('vscode-grading.normalizePointsComments', () => {
		void normalizePointsForAll();
	});
	
	vscode.commands.registerCommand('vscode-grading.addPointsComments', () => {
		void addPointsCommentsForAll();
	});
	
	
	vscode.commands.registerCommand('vscode-grading.addTotalPoints', () => {
		void normalizePointsForActive();
	});
	
	vscode.commands.registerCommand('vscode-grading.checkPoints', () => {
		openWebview('points');
	});
	vscode.commands.registerCommand('vscode-grading.checkPresent', () => {
		openWebview('present');
	});
	vscode.commands.registerCommand('vscode-grading.checkGraded', () => {
		openWebview('graded');
	});
	
	vscode.commands.registerCommand('vscode-grading.setPointsAtCursor', async (newScore?: number, ...rest: unknown[]) => {
		if(typeof newScore !== 'number'){
			newScore = undefined;
		}
		changePointsAtCursor(newScore, false, true);
	});
	
	vscode.commands.registerCommand('vscode-grading.insertCommentAtCursor', async () => {
		appendComment();
	});
	vscode.commands.registerCommand('vscode-grading.insertCommentAtCursorWithLine', async () => {
		changeLine();
	});

	vscode.commands.registerCommand('vscode-grading.incrementAtCursor', async (inc?: number) => {
		if(typeof inc !== 'number'){
			inc = undefined;
		}
		incrementAtCursor(inc);
	});
	vscode.commands.registerCommand('vscode-grading.decrementAtCursor', async (inc?: number) => {
		if(typeof inc !== 'number'){
			inc = undefined;
		}
		incrementAtCursor(inc, true);
	});
}


async function formatAll(): Promise<void> {
	while(true){
		const doc = vscode.window.activeTextEditor?.document;
		if(!doc){
			console.log('no doc');
			break;
		}
		console.log('Formatting + waiting...');
		await vscode.commands.executeCommand('editor.action.formatDocument', doc);
		await new Promise((resolve) => {
			setTimeout(resolve, 5000);
		});
		console.log('Saving...');
		const saveRet = await doc.save();
		if(!saveRet){
			vscode.window.showErrorMessage('Failed to save doc!');
			break;
		}
		console.log('Closing...');
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		// break;
		await new Promise((resolve) => {
			setTimeout(resolve, 1000);
		});
	}
	console.log('Done');
}

