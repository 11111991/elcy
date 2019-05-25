import { propertyChangeDispatherMetaKey, propertyChangeHandlerMetaKey, relationChangeDispatherMetaKey, relationChangeHandlerMetaKey } from "../Decorator/DecoratorKey";
import { EventHandlerFactory } from "../Event/EventHandlerFactory";
import { IEventHandler } from "../Event/IEventHandler";
import { FunctionExpression } from "../ExpressionBuilder/Expression/FunctionExpression";
import { MemberAccessExpression } from "../ExpressionBuilder/Expression/MemberAccessExpression";
import { ParameterExpression } from "../ExpressionBuilder/Expression/ParameterExpression";
import { ExpressionExecutor } from "../ExpressionBuilder/ExpressionExecutor";
import { IChangeEventParam, IRelationChangeEventParam } from "../MetaData/Interface/IChangeEventParam";
import { IEntityMetaData } from "../MetaData/Interface/IEntityMetaData";
import { IRelationMetaData } from "../MetaData/Interface/IRelationMetaData";
import { DbSet } from "./DbSet";
import { EntityState } from "./EntityState";
import { IEntityEntryOption } from "./Interface/IEntityEntry";
import { RelationEntry } from "./RelationEntry";

export class EntityEntry<T = any> implements IEntityEntryOption<T> {
    public get isCompletelyLoaded() {
        return this.dbSet.metaData.columns.all((o) => this.entity[o.propertyName] !== undefined);
    }
    public get metaData(): IEntityMetaData<T> {
        return this.dbSet.metaData;
    }
    public get state() {
        return this._state;
    }
    public set state(value) {
        if (this._state !== value) {
            const dbContext = this.dbSet.dbContext;
            switch (this.state) {
                case EntityState.Added: {
                    const typedAddEntries = dbContext.entityEntries.add.get(this.metaData);
                    if (typedAddEntries) {
                        typedAddEntries.delete(this);
                    }
                    break;
                }
                case EntityState.Deleted: {
                    const typedEntries = dbContext.entityEntries.delete.get(this.metaData);
                    if (typedEntries) {
                        typedEntries.delete(this);
                    }
                    break;
                }
                case EntityState.Modified: {
                    const typedEntries = dbContext.entityEntries.update.get(this.metaData);
                    if (typedEntries) {
                        typedEntries.delete(this);
                    }
                    break;
                }
            }
            switch (value) {
                case EntityState.Added: {
                    let typedEntries = dbContext.entityEntries.add.get(this.metaData);
                    if (!typedEntries) {
                        typedEntries = [];
                        dbContext.entityEntries.add.set(this.metaData, typedEntries);
                    }
                    typedEntries.push(this);
                    break;
                }
                case EntityState.Deleted: {
                    let typedEntries = dbContext.entityEntries.delete.get(this.metaData);
                    if (!typedEntries) {
                        typedEntries = [];
                        dbContext.entityEntries.delete.set(this.metaData, typedEntries);
                    }
                    typedEntries.push(this);
                    break;
                }
                case EntityState.Modified: {
                    let typedEntries = dbContext.entityEntries.update.get(this.metaData);
                    if (!typedEntries) {
                        typedEntries = [];
                        dbContext.entityEntries.update.set(this.metaData, typedEntries);
                    }
                    typedEntries.push(this);
                    break;
                }
            }
            this._state = value;
        }
    }
    constructor(public readonly dbSet: DbSet<T>, public entity: T, public key: string) {
        this._state = EntityState.Detached;

        let propertyChangeHandler: IEventHandler<T, IChangeEventParam<T>> = entity[propertyChangeHandlerMetaKey];
        if (!propertyChangeHandler) {
            let propertyChangeDispatcher: any;
            [propertyChangeHandler, propertyChangeDispatcher] = EventHandlerFactory<T, IChangeEventParam<T>>(entity);
            entity[propertyChangeHandlerMetaKey] = propertyChangeHandler;
            entity[propertyChangeDispatherMetaKey] = propertyChangeDispatcher;
        }
        propertyChangeHandler.add((source: T, args: IChangeEventParam) => this.onPropertyChanged(source, args));

        let relationChangeHandler: IEventHandler<T, IRelationChangeEventParam> = entity[relationChangeHandlerMetaKey];
        if (!relationChangeHandler) {
            let relationChangeDispatcher: any;
            [relationChangeHandler, relationChangeDispatcher] = EventHandlerFactory<T, IRelationChangeEventParam>(entity);
            entity[relationChangeHandlerMetaKey] = relationChangeHandler;
            entity[relationChangeDispatherMetaKey] = relationChangeDispatcher;
        }
        relationChangeHandler.add((source: T, args: IRelationChangeEventParam) => this.onRelationChanged(source, args));
    }

    //#endregion

    public enableTrackChanges = true;
    // TODO: private
    public originalValues: Map<keyof T, any> = new Map();
    public relationMap: { [relationName: string]: Map<EntityEntry, RelationEntry<T, any> | RelationEntry<any, T>> } = {};
    private _state: EntityState;
    public acceptChanges(...properties: Array<keyof T>) {
        if (properties && this.state !== EntityState.Modified) {
            return;
        }

        switch (this.state) {
            case EntityState.Modified: {
                let acceptedProperties: Array<keyof T> = [];
                if (properties) {
                    for (const prop of properties) {
                        const isDeleted = this.originalValues.delete(prop);
                        if (isDeleted) {
                            acceptedProperties.push(prop);
                        }
                    }
                }
                else {
                    acceptedProperties = Array.from(this.originalValues.keys());
                    this.originalValues.clear();
                }

                for (const prop of acceptedProperties.intersect(this.metaData.primaryKeys.select((o) => o.propertyName))) {
                    // reflect update option
                    const relations = this.metaData.relations
                        .where((rel) => rel.isMaster && rel.relationColumns.any((o) => o.propertyName === prop)
                            && (rel.updateOption === "CASCADE" || rel.updateOption === "SET NULL" || rel.updateOption === "SET DEFAULT")
                            && this.relationMap[rel.fullName] !== undefined);
                    for (const rel of relations) {
                        const col = rel.relationColumns.first((o) => o.propertyName === prop);
                        const rCol = rel.relationMaps.get(col);
                        const relationData = this.relationMap[rel.fullName];
                        if (relationData) {
                            for (const relEntry of relationData.values()) {
                                switch (rel.updateOption) {
                                    case "CASCADE": {
                                        relEntry.slaveEntry[rCol.propertyName] = this.entity[prop as keyof T];
                                        break;
                                    }
                                    case "SET NULL": {
                                        relEntry.slaveEntry[rCol.propertyName] = null;
                                        break;
                                    }
                                    case "SET DEFAULT": {
                                        relEntry.slaveEntry[rCol.propertyName] = rCol ? ExpressionExecutor.execute(rCol.defaultExp) : null;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                if (this.originalValues.size <= 0) {
                    this.state = EntityState.Unchanged;
                }
                break;
            }
            case EntityState.Deleted: {
                this.state = EntityState.Detached;

                for (const relMeta of this.dbSet.metaData.relations) {
                    let relEntities: any[] = [];
                    const relProp = this.entity[relMeta.propertyName];
                    if (Array.isArray(relProp)) {
                        relEntities = relEntities.concat(this.entity[relMeta.propertyName]);
                    }
                    else if (relProp) {
                        relEntities = [relProp];
 }
                    if (relMeta.reverseRelation.relationType === "one") {
                        relEntities.forEach((o) => o[relMeta.reverseRelation.propertyName] = null);
                    }
                    else {
                        relEntities.forEach((o) => o[relMeta.reverseRelation.propertyName].delete(this.entity));
                    }

                    // apply delete option
                    const relations = this.metaData.relations
                        .where((o) => o.isMaster && this.relationMap[o.fullName] !== undefined
                            && (o.updateOption === "CASCADE" || o.updateOption === "SET NULL" || o.updateOption === "SET DEFAULT"));

                    for (const o of relations) {
                        const relEntryMap = this.relationMap[o.fullName];
                        if (relEntryMap) {
                            for (const relEntry of relEntryMap.values()) {
                                switch (o.updateOption) {
                                    case "CASCADE": {
                                        relEntry.slaveEntry.state = EntityState.Deleted;
                                        (relEntry.slaveEntry as EntityEntry).acceptChanges();
                                        break;
                                    }
                                    case "SET NULL": {
                                        for (const rCol of (relEntry.slaveRelation as IRelationMetaData<any, T>).mappedRelationColumns) {
                                            relEntry.slaveEntry[rCol.propertyName] = null;
                                            (relEntry.slaveEntry as EntityEntry).acceptChanges(rCol.propertyName);
                                        }
                                        break;
                                    }
                                    case "SET DEFAULT": {
                                        for (const rCol of (relEntry.slaveRelation as IRelationMetaData<any, T>).mappedRelationColumns) {
                                            if (rCol.defaultExp) {
                                                relEntry.slaveEntry[rCol.propertyName] = ExpressionExecutor.execute(rCol.defaultExp);
                                                (relEntry.slaveEntry as EntityEntry).acceptChanges(rCol.propertyName);
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                break;
            }
            case EntityState.Added: {
                this.state = EntityState.Unchanged;
            }
        }
    }

    public add() {
        this.state = this.state === EntityState.Deleted ? EntityState.Unchanged : EntityState.Added;
    }

    //#region change state

    public delete() {
        this.state = this.state === EntityState.Added || this.state === EntityState.Detached ? EntityState.Detached : EntityState.Deleted;
    }
    public getModifiedProperties() {
        return Array.from(this.originalValues.keys());
    }
    public getOriginalValue(prop: keyof T) {
        return this.originalValues.get(prop);
    }

    public getPrimaryValues() {
        const res: any = {};
        for (const o of this.dbSet.primaryKeys) {
            res[o.propertyName] = this.entity[o.propertyName];
        }
        return res;
    }

    //#region Relations
    public getRelation(relationName: string, relatedEntry: EntityEntry): RelationEntry {
        const relationMeta = this.metaData.relations.first((o) => o.fullName === relationName);
        let relGroup = this.relationMap[relationName];
        if (!relGroup) {
            relGroup = new Map();
            this.relationMap[relationName] = relGroup;
        }
        let relEntry = relGroup.get(relatedEntry);
        if (!relEntry) {
            if (relationMeta.isMaster) {
                relEntry = relatedEntry.getRelation(relationName, this);
            }
            else {
                relEntry = new RelationEntry(this, relatedEntry, relationMeta);
            }
            relGroup.set(relatedEntry, relEntry);
        }
        return relEntry;
    }
    public isPropertyModified(prop: keyof T) {
        return this.originalValues.has(prop);
    }
    /**
     * Load relation to this entity.
     */
    public async loadRelation(...relations: Array<(entity: T) => any>) {
        const paramExp = new ParameterExpression("o", this.dbSet.type);
        const projected = this.dbSet.primaryKeys.select((o) => new FunctionExpression(new MemberAccessExpression(paramExp, o.propertyName), [paramExp])).toArray();
        await this.dbSet.project(...(projected as any[])).include(...relations).find(this.getPrimaryValues());
    }

    //#region asd

    /**
     * Reloads the entity from the database overwriting any property values with values from the database.
     * For modified properties, then the original value will be overwrite with vallue from the database.
     * Note: To clean entity from database, call resetChanges after reload.
     */
    public async reload() {
        await this.dbSet.find(this.getPrimaryValues(), true);
    }
    //#endregion

    public removeRelation(relationEntry: RelationEntry<T, any> | RelationEntry<any, T>) {
        const key = (relationEntry.masterEntry === this ? relationEntry.slaveEntry : relationEntry.masterEntry);
        const relGroup = this.relationMap[relationEntry.slaveRelation.fullName];
        if (relGroup) {
            relGroup.delete(key);
        }
    }
    public resetChanges(...properties: Array<keyof T>) {
        if (properties) {
            for (const prop of properties) {
                if (this.originalValues.has(prop)) {
                    this.entity[prop] = this.originalValues.get(prop);
                }
            }
        }
        else {
            for (const [prop, value] of this.originalValues) {
                if (!properties || properties.contains(prop)) {
                    this.entity[prop] = value;
                }
            }
        }
    }
    public setOriginalValue(property: keyof T, value: any) {
        if (!(property in this.entity)) {
            return;
        }
        if (this.entity[property] === value) {
            this.originalValues.delete(property);
        }
        else if (this.isPropertyModified(property)) {
            this.originalValues.set(property, value);
        }
        else {
            this.enableTrackChanges = false;
            this.entity[property] = value;
            this.enableTrackChanges = true;
        }
    }
    public setOriginalValues(originalValues: { [key: string]: any }) {
        for (const prop in originalValues) {
            const value = originalValues[prop];
            this.setOriginalValue(prop as any, value);
        }
        this.state = this.originalValues.size > 0 ? EntityState.Modified : EntityState.Unchanged;
    }
    // TODO: protected
    public updateRelationKey(relationEntry: RelationEntry<T, any> | RelationEntry<any, T>, oldEntityKey: string) {
        const oldKey = relationEntry.slaveRelation.fullName + ":" + oldEntityKey;
        this.relationMap[oldKey] = undefined;
        relationEntry.join();
    }
    protected onRelationChanged(entity: T, param: IRelationChangeEventParam) {
        for (const item of param.entities) {
            const entry = this.dbSet.dbContext.entry(item);
            const relationEntry = this.getRelation(param.relation.fullName, entry);

            if (this.enableTrackChanges) {
                switch (param.type) {
                    case "add": {
                        if (relationEntry.state === EntityState.Detached) {
                            relationEntry.add();
                        }
                        break;
                    }
                    case "del":
                        if (relationEntry.state !== EntityState.Detached) {
                            relationEntry.delete();
                        }
                        break;
                }
            }
            else {
                relationEntry.state = EntityState.Unchanged;
            }
        }
    }

    //#endregion
}

import "./EntityEntry.partial";
