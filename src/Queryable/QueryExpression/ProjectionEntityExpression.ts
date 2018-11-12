import { GenericType, IObjectType } from "../../Common/Type";
import { QueryBuilder } from "../../QueryBuilder/QueryBuilder";
import { IColumnExpression } from "./IColumnExpression";
import { IEntityExpression } from "./IEntityExpression";
import { SelectExpression } from "./SelectExpression";
import { ColumnExpression } from "./ColumnExpression";
import { IExpression } from "../../ExpressionBuilder/Expression/IExpression";
import { resolveClone, hashCode, hashCodeAdd } from "../../Helper/Util";
import { IOrderQueryDefinition } from "../Interface/IOrderQueryDefinition";

export class ProjectionEntityExpression<T = any> implements IEntityExpression<T> {
    public name: string = "";
    public columns: IColumnExpression[];
    public select?: SelectExpression<T>;
    public get primaryColumns(): IColumnExpression[] {
        if (!this._primaryColumns) {
            this._primaryColumns = this.columns.where((o) => o.isPrimary).toArray();
        }
        return this._primaryColumns;
    }
    public defaultOrders: IOrderQueryDefinition[] = [];
    private _primaryColumns: IColumnExpression[];
    private _selectedColumns: IColumnExpression[];
    private _relationColumns: IColumnExpression[];
    public alias: string;
    public readonly entityTypes: IObjectType[];
    constructor(public subSelect: SelectExpression<T>, public readonly type: GenericType<T> = Object as any) {
        this.alias = subSelect.entity.alias;
        this.name = subSelect.entity.name;
        this.columns = subSelect.projectedColumns.select(o => {
            const col = new ColumnExpression(this, o.type, o.propertyName, o.columnName, o.isPrimary, o.columnType);
            col.columnMetaData = o.columnMetaData;
            return col;
        }).toArray();
        // TODO
        // this.defaultOrders = subSelect.orders.slice(0) as any;
        this.entityTypes = this.subSelect.entity.entityTypes.slice();
    }
    public get selectedColumns() {
        if (!this._selectedColumns)
            this._selectedColumns = this.subSelect.selects.select(o => this.columns.first(c => c.columnName === o.columnName)).toArray();
        return this._selectedColumns;
    }
    public get relationColumns() {
        if (!this._relationColumns)
            this._relationColumns = this.subSelect.relationColumns.select(o => this.columns.first(c => c.columnName === o.columnName)).toArray();
        return this._relationColumns;
    }
    public toString(queryBuilder: QueryBuilder): string {
        return queryBuilder.getExpressionString(this);
    }
    public execute(queryBuilder: QueryBuilder): any {
        return queryBuilder.getExpressionString(this);
    }
    public clone(replaceMap?: Map<IExpression, IExpression>) {
        if (!replaceMap) replaceMap = new Map();
        const select = resolveClone(this.select, replaceMap);
        const clone = new ProjectionEntityExpression(select, this.type);
        clone.alias = this.alias;
        clone.defaultOrders = this.defaultOrders.slice();
        clone.name = this.name;
        clone.columns = this.columns.select(o => resolveClone(o, replaceMap)).toArray();
        replaceMap.set(this, clone);
        return clone;
    }
    public hashCode() {
        return hashCodeAdd(hashCode("PROJECTION", this.subSelect.hashCode()), this.columns.sum(o => o.hashCode()));
    }
}
