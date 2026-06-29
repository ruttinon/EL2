import type { GraphicObjectAction, GraphicActionType } from '../graphics.js';
/** Condition expression for animations / visibility. */
export type ConditionOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';
export type TagCondition = {
    op: 'tag';
    tagId: string;
    cmp: ConditionOp;
    value?: number | string | boolean;
    min?: number;
    max?: number;
};
export type AlarmCondition = {
    op: 'alarm';
    severity?: string;
    active?: boolean;
};
export type OnlineCondition = {
    op: 'online';
    deviceId: string;
};
export type LogicCondition = {
    op: 'and' | 'or' | 'not';
    args?: WidgetCondition[];
    arg?: WidgetCondition;
};
export type WidgetCondition = TagCondition | AlarmCondition | OnlineCondition | LogicCondition;
export type AnimationKind = GraphicActionType | 'pulse' | 'scale' | 'flowDash' | 'swapSymbol';
export type WidgetAnimation = {
    id: string;
    when: WidgetCondition;
    kind: AnimationKind;
    priority?: number;
    options?: {
        duration?: number;
        interval?: number;
        easing?: string;
        fillA?: string;
        fillB?: string;
        color?: string;
        stroke?: string;
        minAngle?: number;
        maxAngle?: number;
        toX?: number;
        toY?: number;
        flowSpeed?: number;
        imageUrl?: string;
    };
};
/**
 * Phase 1 animation schema.
 * `animations` is the v3 name; `actions` remains legacy-compatible (GraphicObjectAction[]).
 */
export type WidgetAnimationSchema = {
    animations?: WidgetAnimation[];
    actions?: GraphicObjectAction[];
};
