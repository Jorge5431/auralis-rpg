import { describe, it, expect } from "vitest";
import {
  newState,
  trade,
  craft,
  takeItem,
  progressQuest,
  damage,
  validateSave,
  quests,
} from "../src/v10/State";
import { height, edge, lake, pathDistance } from "../src/v10/Terrain";
describe("Transações e progressão", () => {
  it("compra e venda conservam itens e saldo sem permitir dívida", () => {
    const s = newState();
    expect(trade(s, "sword", true)).toBe(false);
    expect(s.gold).toBe(30);
    expect(trade(s, "potion", true)).toBe(true);
    expect(s.gold).toBe(10);
    expect(s.inventory.potion).toBe(3);
    expect(trade(s, "potion", false)).toBe(true);
    expect(s.gold).toBe(20);
    expect(s.inventory.potion).toBe(2);
    expect(takeItem(s, "wood", -1)).toBe(false);
  });
  it("craft é atômico quando faltam materiais", () => {
    const s = newState();
    s.inventory = { wood: 2, ore: 2 };
    expect(craft(s, "sword")).toBe(false);
    expect(s.inventory).toEqual({ wood: 2, ore: 2 });
    s.inventory.ore = 3;
    expect(craft(s, "sword")).toBe(true);
    expect(s.inventory).toEqual({ wood: 0, ore: 0, sword: 1 });
  });
  it("recompensas só são aplicadas ao objetivo ativo", () => {
    const s = newState();
    expect(progressQuest(s, "wolf")).toBe(false);
    expect(s.quest).toBe(0);
    expect(progressQuest(s, "guild")).toBe(true);
    expect(s.gold).toBe(45);
    expect(progressQuest(s, "guild")).toBe(false);
    for (let i = 0; i < 3; i++) progressQuest(s, "wool");
    expect(s.quest).toBe(2);
    expect(s.xp).toBe(100);
  });
  it("equipamento e experiência mudam dano", () => {
    const s = newState(),
      d = damage(s);
    s.equipped = true;
    expect(damage(s)).toBe(d + 8);
    s.xp = 100;
    expect(damage(s)).toBe(d + 11);
  });
  it("rejeita saves corrompidos e inventário inválido", () => {
    const s = newState();
    expect(validateSave(s)).toBe(true);
    expect(validateSave({ ...s, position: [NaN, 0, 0] })).toBe(false);
    expect(validateSave({ ...s, inventory: { potion: -1 } })).toBe(false);
    expect(validateSave({ ...s, version: 9 })).toBe(false);
    expect(validateSave({ ...s, quest: quests.length + 1 })).toBe(false);
  });
});
describe("Geografia", () => {
  it("mantém lago central, vila ao norte e montanhas ao sul", () => {
    expect(lake(0, 0)).toBe(0);
    expect(height(0, 0)).toBeLessThan(5.4);
    expect(height(0, -135)).toBeCloseTo(10);
    expect(height(10, 193)).toBeGreaterThan(70);
    expect(edge(0, 0)).toBe(0);
    expect(edge(300, 0)).toBeGreaterThan(1);
  });
  it("caminho principal contínuo possui inclinações caminháveis", () => {
    for (let z = -140; z < -100; z++) {
      expect(Math.abs(height(0, z + 1) - height(0, z))).toBeLessThan(0.7);
      expect(pathDistance(0, z)).toBeLessThan(0.01);
    }
  });
});
