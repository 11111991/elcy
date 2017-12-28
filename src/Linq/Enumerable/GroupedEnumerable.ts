import { Enumerable } from "./Enumerable";
import { GroupByEnumerable } from "./GroupByEnumerable";

export class GroupedEnumerable<T, K> extends Enumerable<T> {
    public get source() {
        return this.parent.parent;
    }
    public get keySelector() {
        return this.parent.keySelector;
    }
    constructor(protected readonly parent: GroupByEnumerable<T, K>, public readonly key: K) {
        super();
    }
    public addResult(value: T) {
        this.result.add(value);
    }
    public next() {
        let result: IteratorResult<T> = {
            done: this.result.length < this.pointer,
            value: this.result[this.pointer]
        };
        if (result.done && !this.isResultComplete) {
            let curKey: K | undefined;
            do {
                if (curKey && result) {
                    this.parent.addResult(curKey, result.value);
                }
                result = this.source.next();
                if (result.done) {
                    this.isResultComplete = true;
                    return result;
                }
                curKey = this.keySelector(result.value);
            } while (!this.keyComparer(curKey, this.key));
            this.result[this.pointer++] = result.value;
        }
        return result;
    }
    private keyComparer = (a: K, b: K) => a instanceof Object ? JSON.stringify(a) === JSON.stringify(b) : a === b;
}
