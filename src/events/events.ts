import {
  EventEnvelope,
} from './event-envelope.js';

/*
 * =====================================================
 * ORDER CREATED
 * =====================================================
 */

export type OrderCreatedEvent = {
  id: string;

  eventName: string;

  email: string;

  quantity: number;

  status: string;
};

export type OrderCreatedEnvelope =
  EventEnvelope<OrderCreatedEvent>;


/*
 * =====================================================
 * INVENTORY RESERVED
 * =====================================================
 */

export type InventoryReservedEvent = {
  orderId: string;

  quantity: number;

  unitPrice: number;
};

export type InventoryReservedEnvelope =
  EventEnvelope<InventoryReservedEvent>;


/*
 * =====================================================
 * INVENTORY REJECTED
 * =====================================================
 */

export type InventoryRejectedEvent = {
  orderId: string;

  quantity: number;

  reason: string;
};

export type InventoryRejectedEnvelope =
  EventEnvelope<InventoryRejectedEvent>;

  /*
 * =====================================================
 * INVENTORY RELEASE
 * =====================================================
 */

export type InventoryReleaseEvent = {
  orderId: string;
};

export type InventoryReleaseEnvelope =
  EventEnvelope<InventoryReleaseEvent>;