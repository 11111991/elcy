import { GenericType, IObjectType } from "../../Common/Type";
import { IExpression } from "../../ExpressionBuilder/Expression/IExpression";
import { hashCode, hashCodeAdd, resolveClone } from "../../Helper/Util";
import { ProjectionEntityExpression } from "./ProjectionEntityExpression";
import { SelectExpression } from "./SelectExpression";

export class ExceptExpression<T> extends ProjectionEntityExpression<T> {
    constructor(public readonly subSelect: SelectExpression<T>, public readonly subSelect2: SelectExpression, type?: GenericType<T>) {
        super(subSelect, type);
        this.subSelect2.isSubSelect = true;
        this.entityTypes = this.subSelect.entity.entityTypes.concat(this.subSelect2.entity.entityTypes).distinct().toArray();
    }
    public readonly entityTypes: IObjectType[];
    public clone(replaceMap?: Map<IExpression, IExpression>) {
        if (!replaceMap) {
            replaceMap = new Map();
        }
        const select = resolveClone(this.subSelect, replaceMap);
        const select2 = resolveClone(this.subSelect2, replaceMap);
        const clone = new ExceptExpression(select, select2, this.type);
        replaceMap.set(this, clone);
        return clone;
    }
    public hashCode() {
        return hashCodeAdd(hashCode("EXCEPT", this.subSelect.hashCode()), this.subSelect2.hashCode());
    }
    public toString(): string {
        return `Except(${this.subSelect.toString()}, ${this.subSelect2.toString()})`;
    }
}
