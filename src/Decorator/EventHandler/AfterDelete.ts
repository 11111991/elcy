import "reflect-metadata";
import { IObjectType } from "../../Common/Type";
import { EntityMetaData } from "../../MetaData";
import { IDeleteEventParam, IEntityMetaData } from "../../MetaData/Interface";
import { entityMetaKey } from "../DecoratorKey";
/**
 * Register before save event. only for concrete entity
 */
export function AfterDelete<T = any>(handler?: (this: T, item?: IDeleteEventParam) => void) {
    return (target: object | IObjectType<T>, propertyKey?: string /* | symbol*/, descriptor?: PropertyDescriptor) => {
        const entityMetaData: IEntityMetaData<any> = Reflect.getOwnMetadata(entityMetaKey, propertyKey ? target.constructor : target);
        if (!(entityMetaData instanceof EntityMetaData))
            return;

        if (!handler && descriptor && typeof descriptor.value === "function")
            handler = descriptor.value;

        if (handler)
            entityMetaData.afterDelete.add(handler);
    };
}