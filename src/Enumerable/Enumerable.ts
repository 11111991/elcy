export const keyComparer = <T = any>(a: T, b: T) => {
    let result = a === b;
    if (!result && a instanceof Object) {
        try {
            const aKeys = Object.keys(a);
            const bKeys = Object.keys(b);
            result = aKeys.length === bKeys.length;
            if (result) {
                result = aKeys.all(o => b.hasOwnProperty(o) && (b as any)[o] === (a as any)[o]);
            }
        }
        catch (e) {

        }
    }
    return result;
};
export class Enumerable<T = any> implements Iterable<T> {
    public static load<T>(source?: Iterable<T> | Iterator<T>){
        return new Enumerable(source);
    }
    protected pointer = 0;
    protected isResultComplete: boolean;
    protected result: T[] = [];
    protected parent: Iterable<any>;
    protected iterator: Iterator<any>;
    constructor(source?: Iterable<T> | Iterator<T>) {
        if (source) {
            if (Array.isArray(source)) {
                this.result = source;
                this.parent = source;
                this.isResultComplete = true;
            }
            else if ((source as Iterator<T>).next) {
                this.iterator = source as Iterator<T>;
            }
            else {
                this.parent = source as Iterable<T>;
                this.iterator = this.parent[Symbol.iterator]();
            }
        }
    }
    public [Symbol.iterator](): IterableIterator<T> {
        if (this.isResultComplete)
            return this.result[Symbol.iterator]();
        return this.generator();
    }
    protected *generator() {
        const result = [];
        let iterateResult;
        while (iterateResult = this.iterator.next(), !iterateResult.done) {
            result.push(iterateResult.value);
            yield iterateResult.value;
        }
        this.result = result;
        this.isResultComplete = true;
    }
    public reset() {
        if (this.parent) {
            this.iterator = this.parent[Symbol.iterator]();
            this.result = [];
            this.isResultComplete = false;
        }
    }
    public toArray(): T[] {
        if (this.isResultComplete) {
            return this.result;
        }

        const arr = [];
        for (const i of this) {
            arr.push(i);
        }
        return arr;
    }
    public all(predicate?: (item: T) => boolean): boolean {
        for (const item of this) {
            if (predicate && !predicate(item)) {
                return false;
            }
        }
        return true;
    }
    public any(predicate?: (item: T) => boolean): boolean {
        for (const item of this) {
            if (!predicate || predicate(item)) {
                return true;
            }
        }
        return false;
    }
    public first(predicate?: (item: T) => boolean): T | null {
        for (const item of this) {
            if (!predicate || predicate(item)) {
                return item;
            }
        }
        return null;
    }
    public count(predicate?: (item: T) => boolean): number {
        let count = 0;
        for (const item of this) {
            if (!predicate || predicate(item))
                count++;
        }
        return count;
    }
    public sum(selector?: (item: T) => number): number {
        let sum = 0;
        for (const item of this) {
            sum += selector ? selector(item) : item as any;
        }
        return sum;
    }
    public avg(selector?: (item: T) => number): number {
        let sum = 0;
        let count = 0;
        for (const item of this) {
            sum += selector ? selector(item) : item as any;
            count++;
        }
        return sum / count;
    }
    public max(selector?: (item: T) => number): number {
        let max = -Infinity;
        for (const item of this) {
            const num = selector ? selector(item) : item as any;
            if (max < num)
                max = num;
        }
        return max;
    }
    public min(selector?: (item: T) => number): number {
        let min = Infinity;
        for (const item of this) {
            const num = selector ? selector(item) : item as any;
            if (!min || min > num)
                min = num;
        }
        return min;
    }
    public contains(item: T): boolean {
        for (const it of this) {
            if (it === item)
                return true;
        }
        return false;
    }

    // Helper extension
    public each(executor: (item: T, index: number) => void): void {
        let index = 0;
        for (const item of this) {
            executor(item, index++);
        }
    }
    public reduce<R>(func: (accumulated: R, item: T) => R): R;
    public reduce<R>(seed: R, func: (accumulated: R, item: T) => R): R;
    public reduce<R>(seedOrFunc: R | ((accumulated: R, item: T) => R), func?: (accumulated: R, item: T) => R): R {
        let accumulated: R;
        if (func) {
            accumulated = seedOrFunc as any;
        }
        else {
            func = seedOrFunc as any;
        }

        for (const a of this) {
            accumulated = func(accumulated, a);
        }
        return accumulated;
    }
}
