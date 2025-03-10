import { ClassInterface } from 'classInterface';
import { DeleteVehicle, IsPlateAvailable, IsVinAvailable, SaveVehicleData, SetVehicleColumn } from './db';
import { getRandomString, getRandomAlphanumeric, getRandomChar, getRandomInt } from '@overextended/ox_lib';
import { PLATE_PATTERN } from '../../common/config';
import { Dict } from 'types';

export class OxVehicle extends ClassInterface {
  entity: number;
  netId: number;
  script: string;
  plate: string;
  model: string;
  make: string;
  id?: number;
  vin?: string;
  owner?: number;
  group?: string;
  #metadata: Dict<any>;
  #stored?: string;

  protected static members: Dict<OxVehicle> = {};
  protected static keys: Dict<Dict<OxVehicle>> = {
    id: {},
    netId: {},
  };

  /** Get an instance of OxVehicle with the matching entityId. */
  static get(entityId: string | number) {
    return this.members[entityId];
  }

  /** Get an instance of OxVehicle with the matching vehicleId. */
  static getFromVehicleId(vehicleId: number) {
    return this.keys.id[vehicleId];
  }

  /** Get an instance of OxVehicle with the matching netId. */
  static getFromNetId(id: number) {
    return this.keys.netId[id];
  }

  /** Gets all instances of OxVehicle. */
  static getAll(): Dict<OxVehicle> {
    return this.members;
  }

  static async generateVin(vehicle: OxVehicle) {
    const arr = [
      getRandomInt(),
      vehicle.make ? vehicle.make.slice(0, 2).toUpperCase() : 'OX',
      vehicle.model.slice(0, 2).toUpperCase(),
      null,
      null,
      +Date() / 1000,
    ];

    while (true) {
      arr[3] = getRandomAlphanumeric();
      arr[4] = getRandomChar();
      const vin = arr.join('');

      if (await IsVinAvailable(vin)) return vin;
    }
  }

  static async generatePlate() {
    while (true) {
      const plate = getRandomString(PLATE_PATTERN);

      if (await IsPlateAvailable(plate)) return plate;
    }
  }

  static saveAll(resource?: string) {
    if (resource === 'ox_core') resource = null;

    const parameters = [];

    for (const id in this.members) {
      const vehicle = this.members[id];

      if (!resource || resource === vehicle.script) {
        if (vehicle.owner || vehicle.group) parameters.push(vehicle.#getSaveData());

        vehicle.despawn();
      }
    }

    DEV: console.info(`Saving ${parameters.length} vehicles to the database.`);

    if (parameters.length > 0) {
      SaveVehicleData(parameters, true);
      emit('ox:savedVehicles', parameters.length);
    }
  }

  constructor(
    entity: number,
    script: string,
    plate: string,
    model: string,
    make: string,
    id?: number,
    vin?: string,
    owner?: number,
    group?: string,
    metadata?: Dict<any>,
    stored?: string
  ) {
    super();
    this.entity = entity;
    this.netId = NetworkGetNetworkIdFromEntity(entity);
    this.script = script;
    this.plate = plate;
    this.model = model;
    this.make = make;
    this.id = id;
    this.vin = vin;
    this.owner = owner;
    this.group = group;
    this.#metadata = metadata || {};
    this.#stored = stored;

    OxVehicle.add(this.entity, this);
    SetVehicleNumberPlateText(this.entity, this.plate);
    emit('ox:spawnedVehicle', this.entity, this.id);
  }

  /** Stores a value in the vehicle's metadata. */
  set(key: string, value: any) {
    this.#metadata[key] = value;
  }

  /** Gets a value stored in vehicle's metadata. */
  get(key: string) {
    return this.#metadata[key];
  }

  #getSaveData(): [string | null, string, number] {
    if (!this.id) return;

    return [this.#stored, JSON.stringify(this.#metadata), this.id];
  }

  save() {
    return this.id && SaveVehicleData(this.#getSaveData());
  }

  despawn(save?: boolean) {
    if (save && this.id) SaveVehicleData(this.#getSaveData());
    if (DoesEntityExist(this.entity)) DeleteEntity(this.entity);

    OxVehicle.remove(this.entity);
  }

  delete() {
    if (this.id) DeleteVehicle(this.id);
    this.despawn(false);
  }

  setStored(value: string, despawn?: boolean) {
    this.#stored = value;

    if (despawn) return this.despawn(true);

    SetVehicleColumn(this.id, 'stored', value);
  }

  setOwner(charId?: number) {
    if (this.owner === charId) return;

    charId ? (this.owner = charId) : delete this.owner;

    SetVehicleColumn(this.id, 'owner', this.group);
  }

  setGroup(group?: string) {
    if (this.group === group) return;

    group ? (this.group = group) : delete this.group;

    SetVehicleColumn(this.id, 'group', this.group);
  }

  setPlate(plate: string) {
    if (this.plate === plate) return;

    this.plate = plate.padEnd(8);

    SetVehicleColumn(this.id, 'plate', this.plate);
  }
}

OxVehicle.init();

exports('SaveAllVehicles', OxVehicle.saveAll);
