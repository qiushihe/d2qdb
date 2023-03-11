import { SingleComponentResponseOfDestinyVendorGroupComponent } from "~type/bungie-api.types";
import { SingleComponentResponseOfDestinyCharacterComponent } from "~type/bungie-api.types";
import { SingleComponentResponseOfDestinyCharacterProgressionComponent } from "~type/bungie-api.types";
import { SingleComponentResponseOfDestinyInventoryComponent } from "~type/bungie-api.types";
import { DictionaryComponentResponseOfuint32AndDestinyVendorComponent } from "~type/bungie-api.types";
import { DictionaryComponentResponseOfint64AndDestinyCharacterComponent } from "~type/bungie-api.types";
import { SingleComponentResponseOfDestinyItemInstanceComponent } from "~type/bungie-api.types";

export type DestinyItemResponse = {
  instance: SingleComponentResponseOfDestinyItemInstanceComponent;
};

export type DestinyCharacterResponse = {
  character?: SingleComponentResponseOfDestinyCharacterComponent;
  equipment?: SingleComponentResponseOfDestinyInventoryComponent;
  inventory?: SingleComponentResponseOfDestinyInventoryComponent;
  progressions?: SingleComponentResponseOfDestinyCharacterProgressionComponent;
};

export type DestinyProfileResponse = {
  characters?: DictionaryComponentResponseOfint64AndDestinyCharacterComponent;
};

export type DestinyVendorsResponse = {
  vendorGroups?: SingleComponentResponseOfDestinyVendorGroupComponent;
  vendors?: DictionaryComponentResponseOfuint32AndDestinyVendorComponent;
};
