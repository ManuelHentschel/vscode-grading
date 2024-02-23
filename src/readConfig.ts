
import * as types from './types';
import * as vscode from 'vscode';


export function getExNames(): string[] {
    const exercises = getFlatConfigExercises();
    return exercises.map(ex => ex.name);
}


export interface RegExpExecReplaceArray extends RegExpExecArray{
    replacedText?: string;
}


interface ParsePatterns{
    exercise: RegExp;
    exerciseEnd?: RegExp;
    comment: RegExp;
    points: RegExp;
    fullPoints: RegExp;
}

// export function getParseRegexes(): 

export function getParsePatterns(): ParsePatterns {
    const config = getConfig();

    // const endPattern = config.get('exercise.endPattern', defaultEndPattern);

    const regexStringExercise = config.get<string>('exercise.startRegex', '???');
    const regexStringComment = config.get<string>('comment.regex', '???');
    const regexStringPointsComment = config.get<string>('comment.pointsRegex', '???');
    const regexStringFullPointsComment = config.get<string>('comment.fullPointsRegex', '???');
    const regexStringExerciseEnd = config.get<string | undefined | null>('exercise.endRegex', '???');

    const regexExercise = RegExp(regexStringExercise, 'dg');
    const regexComment = RegExp(regexStringComment, 'dg');
    const regexPointsComment = RegExp(regexStringPointsComment, 'dg');
    const regexFullPointsComment = RegExp(regexStringFullPointsComment, 'dg');
    const regexExerciseEnd = regexStringExerciseEnd ? RegExp(regexStringExerciseEnd, 'dg') : undefined;

    return {
        exercise: regexExercise,
        exerciseEnd: regexExerciseEnd,
        comment: regexComment,
        points: regexPointsComment,
        fullPoints: regexFullPointsComment,
    };
}

export function getConfigExercises(): types.Exercise[] {
    const config = getConfig();
    const configExercises = config.get<types.ConfigExercises>('exercises', []);
    const exercises = parseConfigExercises(configExercises, '');
    return exercises;
}

function parseConfigExercises(exercises: types.ConfigExercises, parentId: string): types.Exercise[] {
    if(Array.isArray(exercises)){
        return exercises.map(ex => parseConfigExercise(ex, parentId));
    }
    const ret: types.Exercise[] = [];
    let order: string[] | undefined;
    for(const [k, v] of Object.entries(exercises)){
        if(k === '_order' && Array.isArray(v)){
            order = v;
            continue;
        }
        if(typeof v === 'number'){
            ret.push(parseConfigExercise({
                name: k,
                atomicPoints: v
            }, parentId));
            continue;
        }
        ret.push(parseConfigExercise({
            ...v,
            name: k
        }, parentId));
    }
    if(order){
        ret.sort((a, b) => {
            const ai = order!.indexOf(a.name);
            const bi = order!.indexOf(b.name);
            if(ai === -1 && bi === -1){
                return a.name.localeCompare(b.name);
            }
            if(ai === -1){
                return 1;
            }
            if(bi === -1){
                return -1;
            }
            return ai - bi;
        });
    }
    return ret;
}

function parseConfigExercise(exercise: types.ConfigExercise, parentId: string): types.Exercise {
    const id = parentId ? `${parentId}_${exercise.name}` : exercise.name;
    const ret: types.Exercise = {
        name: exercise.name,
        id: id,
        atomicPoints: exercise.atomicPoints || 0,
        totalPoints: 0,
        subExercises: []
    };
    if(exercise.subExercises){
        ret.subExercises = parseConfigExercises(exercise.subExercises, ret.id);
    }
    ret.totalPoints = ret.atomicPoints + ret.subExercises.reduce((pv, ex) => pv + ex.totalPoints, 0);
    return ret;
}


export function getFlatConfigExercises(): types.Exercise[] {
    const exercises = getConfigExercises();
    const flatExercises = makeFlatExercises(exercises);
    return flatExercises;
}

export function makeFlatExercises<T extends types.NExercise<T>>(nestedExercises: T[]): T[] {
    const exercises = nestedExercises;
    const ret: T[] = [];
    exercises.forEach(ex => {
        ret.push(ex);
        if(ex.subExercises){
            ret.push(...makeFlatExercises(ex.subExercises));
        }
    });
    return ret;
}

export function getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('grading');
}


