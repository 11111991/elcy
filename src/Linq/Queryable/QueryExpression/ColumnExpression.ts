import { genericType } from "../../../Common/Type";
import { columnMetaKey } from "../../../Decorator/DecoratorKey";
import { ColumnMetaData } from "../../../MetaData/index";
import { QueryBuilder } from "../../QueryBuilder";
import { IColumnExpression } from "./IColumnExpression";
import { IEntityExpression } from "./IEntityExpression";

export class ColumnExpression<T = any, TE = any> implements IColumnExpression<T> {
    public get name() {
        return this.columnMetaData.name;
    }
    public get type(): genericType<T> {
        return this.columnMetaData.type;
    }
    public alias?: string;
    public propertyName: string;
    public get columnMetaData() {
        if (!this._columnMetaData)
            this._columnMetaData = Reflect.getOwnMetadata(columnMetaKey, this.entity.type, this.propertyName);
        return this._columnMetaData;
    }
    public entity: IEntityExpression<TE>;
    // tslint:disable-next-line:variable-name
    private _columnMetaData: ColumnMetaData<T>;
    constructor(entity: IEntityExpression<TE>, propertyName: string, alias?: string) {
        this.entity = entity;
        this.propertyName = propertyName;
        this.alias = alias;
    }
    public toString(queryBuilder: QueryBuilder): string {
        return queryBuilder.toColumnString(this);
    }
    public execute(queryBuilder: QueryBuilder): string {
        return this.toString(queryBuilder);
    }
}
