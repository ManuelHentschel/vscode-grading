
import * as types from './types';
import * as vscode from 'vscode';
import { getConfig, getConfigExercises, getParsePatterns } from './readConfig';
import { assertMinArrayLength, execRegExp } from './utils';



export function parseAndMatchDoc(doc: vscode.TextDocument, id?: string): types.MatchedDocument {
    id ||= doc.fileName;
    console.log(`Parse and match: ${id}`);
    const pDoc = parseDoc(doc, id);
    const mDoc = matchExercises(pDoc);
    return(mDoc);
}

function parseDoc(doc: vscode.TextDocument, id: string): types.ParsedDocument {

    const ret: types.ParsedDocument = {
        document: doc,
        id: id,
        parsedExercises: [],
        parsedComments: []
    };

    const patterns = getParsePatterns();
    
    let lastEx: types.ParsedExercise | undefined = undefined;

    for (let i = 0; i < doc.lineCount; i++) {
        const line = doc.lineAt(i);
        
        // Parse exercise(s) starting in this line
        const m = execRegExp(line, patterns.exercise);
        const m0 = m[0];
        if(m0){
            const m2 = assertMinArrayLength(m0, 2, 'Exercise regex needs to have one capture group!');
            const newExercise: types.ParsedExercise = {
                document: doc,
                range: new vscode.Range(line.range.start, line.range.start),
                text: '',
                name: m2[1].text,
                nameRange: m2[1].range
            };
            ret.parsedExercises.push(newExercise);
            lastEx = newExercise;
        }

        if(patterns.exerciseEnd){
            const em = execRegExp(line, patterns.exerciseEnd);
            if(em[0]){
                lastEx = undefined;
            }
        }

        if(lastEx){
            lastEx.range = new vscode.Range(lastEx.range.start, line.range.end);
            lastEx.text = lastEx.document.getText(lastEx.range);
        }
        
        // Parse comments in this line
        const regexMatches = execRegExp(line, patterns.comment);
        for(const match of regexMatches){
            const match2 = assertMinArrayLength(match, 2, 'Comment regex needs to have one capture group!');
            const tmp: types.ParsedComment = {
                document: doc,
                range: match2[0].range,
                text: match2[0].text,
                content: match2[1]
            };
            ret.parsedComments.push(tmp);
        }
    }

    return ret;
}

function makeMatchedExercises(exercises: types.Exercise[]): types.MatchedExercise[] {
    return exercises.map(ex => ({
        ...ex,
        subExercises: makeMatchedExercises(ex.subExercises),
        achievedAtomicPoints: 0,
        achievedTotalPoints: 0,
        parsedExercises: [],
        parsedComments: [],
        pointsComments: []
    }));
}

function matchExercises(pDoc: types.ParsedDocument): types.MatchedDocument {
    const ret: types.MatchedDocument = {
        document: pDoc.document,
        id: pDoc.id,
        exercises: makeMatchedExercises(getConfigExercises()),
        unmatchedExercises: [],
        unmatchedComments: [],
        unmatchedPointsComments: []
    };

    let ind: number[] = [];

    const config = getConfig();
    const allowMultiplePoints = config.get<boolean>('allowMultiplePointsComments', false);
    const allowMultipleParsedExercises = config.get<boolean>('allowMultipleParsedExercises', false);

    // Match parsed exercises to configured (=expected) ones
    for(const pex of pDoc.parsedExercises){
        const newInds = findExercise(pex, ret.exercises, ind);
        const exs = newInds.map(ind => getNestedExercise(ret.exercises, ind));
        if(!exs.length){
            ret.unmatchedExercises.push(pex);
            continue;
        }
        let i = (
            exs.findIndex(ex => ex?.parsedExercises.length === 0)
        );
        if(i < 0){
            if(!allowMultipleParsedExercises){
                pex.isDuplicate = true;
                ret.unmatchedExercises.push(pex);
                continue;
            }
            i = 0;
        }
        const ex = exs[i]!; // `!` ok because checked above
        ind = newInds[i]!;
        ex.parsedExercises.push(pex);
    }

    
    // Match comments to exercises
    const pointsPlaceHolder = config.get('comment.pointsPlaceHolder', '???');
    for(const pcomment of pDoc.parsedComments){
        const [ex, _] = findContainingExercise(ret.exercises, pcomment.range);
        const ppcomment = tryParsePointComment(pcomment, pointsPlaceHolder) || tryParseFullPointsComment(pcomment, ex);
        if(!ex){
            if(ppcomment){
                ppcomment.isUnmatched = true;
                ret.unmatchedPointsComments.push(ppcomment);
            } else {
                ret.unmatchedComments.push(pcomment);
            }
            continue;
        }
        if(!ppcomment){
            ex.parsedComments.push(pcomment);
            continue;
        }
        if(ex.pointsComments.length && !allowMultiplePoints){
            ppcomment.isDuplicate = true;
            ret.unmatchedPointsComments.push(ppcomment);
            continue;
        }
        ex.pointsComments.push(ppcomment);
    }
    
    // Compute total points
    for(const ex of ret.exercises){
        computeAchievedPoints(ex);
    }

    return ret;
}

function computeAchievedPoints(ex: types.MatchedExercise): types.MatchedExercise {
    ex.achievedAtomicPoints = 0;
    for(const pex of ex.pointsComments){
        ex.achievedAtomicPoints += pex.pointsScore;
    }
    let total = ex.achievedAtomicPoints;
    for(const subEx of ex.subExercises){
        computeAchievedPoints(subEx);
        total += subEx.achievedTotalPoints;
    }
    ex.achievedTotalPoints = total;
    return ex;
}


function tryParsePointComment(pcomm: types.ParsedComment, placeHolder: string): types.PointComment | undefined {
    const allPatterns = getParsePatterns();
    const re = allPatterns.points;
    const matches = execRegExp(pcomm.content, re);
    const match = matches[0];
    if(!match){
        return undefined;
    }
    const match4 = assertMinArrayLength(match, 4, 'Points regex needs to have three capture groups!');
    const ret: types.PointComment = {
        ...pcomm,
        pointsOfTotal: match4[1],
        pointsText: match4[2],
        remark: match4[3],
        pointsScore: 0,
        isFullPoints: false
    };
    if(ret.pointsText.text === placeHolder){
        ret.isPlaceHolder = true;
    } else {
        const pointsScore = Number(ret.pointsText.text);
        ret.pointsScore = pointsScore;
    }
    return ret;
}

function tryParseFullPointsComment(pcomm: types.ParsedComment, ex?: types.Exercise): types.PointComment | undefined {
    const allPatterns = getParsePatterns();
    const re = allPatterns.fullPoints;
    const matches = execRegExp(pcomm.content, re);
    const match = matches[0];
    if(!match){
        return undefined;
    }
    const match3 = assertMinArrayLength(match, 3, 'Full points regex needs to have two capture groups!');
    const ret: types.PointComment = {
        ...pcomm,
        pointsOfTotal: match3[1],
        pointsText: match3[1],
        remark: match3[2],
        pointsScore: ex?.totalPoints || 0,
        isFullPoints: true
    };
    return ret;
}

function makeDeepCopy(exercise: types.Exercise): types.Exercise {
    return {
        ...exercise,
        subExercises: exercise.subExercises.map(makeDeepCopy)
    };
}

function findExercise2(pex: types.ParsedExercise, exercises: types.Exercise[], ind: number[]): number[] | undefined {
    const ind0 = exercises.findIndex(ex => ex.name === pex.name);
    if(ind0 >= 0){
        return [ind0];
    }
    const ind1 = [];
    for(const i of ind){
        ind1.push(i);
        exercises = exercises[i]?.subExercises || [];
        const ind0 = exercises.findIndex(ex => ex.name === pex.name);
        if(ind0 >= 0){
            ind1.push(ind0);
            return ind1;
        }
    }
    return undefined;
}

function findExercise(pex: types.ParsedExercise, exercises: types.Exercise[], ind: number[]): number[][] {
    const ret: number[][] = [];
    const i = ind[0];
    if(i !== undefined){
        // recursion below:
        const ex = exercises[i];
        if(ex){
            const ind1 = findExercise(pex, ex.subExercises, ind.slice(1));
            for(const ind11 of ind1){
                ret.push([i, ...ind11]);
            }
        }
    }
    const ind0 = exercises.findIndex(ex => ex.name === pex.name);
    if(ind0 >= 0){
        ret.push([ind0]);
    }
    return ret;
}

function getNestedExercise<T extends types.NExercise<T>>(exercises: T[], ind: number[]): T {
    let ex: T | undefined;
    for(const i of ind){
        ex = exercises[i];
        exercises = ex?.subExercises || [];
    }
    if(!ex){
        throw new Error(`Invalid index: ${ind}`);
    }
    return ex;
}

export function findContainingExercise(exercises: types.MatchedExercise[], range: vscode.Range | vscode.Position): [types.MatchedExercise, types.ParsedExercise] | [undefined, undefined] {
    for(const ex of exercises){
        let pex = findContainingParsedExercise(ex.parsedExercises, range);
        if(pex){
            return [ex, pex];
        }
        const ret = findContainingExercise(ex.subExercises, range);
        if(ret[0]){
            return ret;
        }
    }
    return [undefined, undefined];
}

export function findContainingParsedExercise(parsedExercises: types.ParsedExercise[], range: vscode.Range | vscode.Position): types.ParsedExercise | undefined {
    for(const pex of parsedExercises){
        if(pex.range.contains(range)){
            return pex;
        }
    }
    return undefined;
}
