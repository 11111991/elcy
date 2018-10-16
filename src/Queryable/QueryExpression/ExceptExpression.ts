import { QueryBuilder } from "../../QueryBuilder/QueryBuilder";
import { ProjectionEntityExpression } from "./ProjectionEntityExpression";
import { SelectExpression } from "./SelectExpression";
import { IObjectType } from "../../Common/Type";
import { IExpression } from "../../ExpressionBuilder/Expression/IExpression";
import { resolveClone, hashCodeAdd, hashCode } from "../../Helper/Util";

export class ExceptExpression<T> extends ProjectionEntityExpression<T> {
    public readonly entityTypes: IObjectType[];
    constructor(public readonly select: SelectExpression<T>, public readonly select2: SelectExpression, public readonly type: IObjectType<T> = Object as any) {
        super(select, type);
        this.entityTypes = this.select.entity.entityTypes.concat(this.select2.entity.entityTypes).distinct().toArray();
    }
    public toString(queryBuilder: QueryBuilder): string {
        return queryBuilder.getExpressionString(this);
    }
    public execute(queryBuilder: QueryBuilder): any {
        throw new Error("Method not implemented.");
    }
    public clone(replaceMap?: Map<IExpression, IExpression>) {
        if (!replaceMap) replaceMap = new Map();
        const select = resolveClone(this.select, replaceMap);
        const select2 = resolveClone(this.select2, replaceMap);
        const clone = new ExceptExpression(select, select2, this.type);
        replaceMap.set(this, clone);
        return clone;
    }
    public hashCode() {
        return hashCodeAdd(hashCode("EXCEPT", this.select.hashCode()), this.select2.hashCode());
    }
}
