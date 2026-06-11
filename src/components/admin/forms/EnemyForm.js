'use client';
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = EnemyForm;
var react_1 = require("react");
var navigation_1 = require("next/navigation");
var actions_1 = require("@/app/admin/actions");
var skills_json_1 = require("@/data/master/skills.json");
var FormTabs_1 = require("./shared/FormTabs");
var FormSaveBar_1 = require("./shared/FormSaveBar");
var FormField_1 = require("./shared/FormField");
var StatInputGrid_1 = require("./shared/StatInputGrid");
var ResistanceGrid_1 = require("./shared/ResistanceGrid");
var DropTableEditor_1 = require("./shared/DropTableEditor");
var gimmickValue_1 = require("./shared/gimmickValue");
var JsonSidebar_1 = require("./shared/JsonSidebar");
var ConfirmDialog_1 = require("./shared/ConfirmDialog");
var DependenciesTab_1 = require("./shared/DependenciesTab");
var AIEnemyDraftPanel_1 = require("../AIEnemyDraftPanel");
var TABS = ['基本情報', 'ステータス', '属性耐性', 'ネクロマンス', 'ギミック', 'ドロップ', 'バトル', '依存関係'];
var TIERS = ['MINION', 'ELITE', 'BOSS'];
var TRIBES = ['UNDEAD', 'DEMON', 'BEAST', 'HUMANOID', 'DRAGON', 'ORC'];
var SPRITES = ['WRAITH', 'GIANT', 'WYRM'];
var ELEMENTS = ['FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK', 'NONE'];
var GIMMICK_TRIGGERS = ['HP_BELOW_50', 'TURN_3', 'ON_SHIELD_BREAK', 'ON_REVIVE'];
var GIMMICK_EFFECTS = ['ENRAGE', 'AV_DELAY', 'REVIVE', 'SUMMON_MINIONS'];
var MASTER_SKILLS = skills_json_1.default;
var NECROMANCE_RATE_BY_TIER = { MINION: 0.12, ELITE: 0.04, BOSS: 0.001 };
var NECROMANCE_COST_BY_TIER = { MINION: 1, ELITE: 2, BOSS: 4 };
var inputStyle = {
    background: '#1a1a24',
    border: '1px solid rgba(139,0,255,0.2)',
    borderRadius: 6,
    padding: '0 12px',
    height: 44,
    boxSizing: 'border-box',
    color: '#e0d0ff',
    fontSize: 14,
    width: '100%',
    outline: 'none',
    fontFamily: 'monospace',
};
var selectStyle = __assign(__assign({}, inputStyle), { cursor: 'pointer' });
var textareaStyle = __assign(__assign({}, inputStyle), { height: undefined, resize: 'vertical', minHeight: 96 });
var SKILL_OPTIONS = Object.entries(MASTER_SKILLS)
    .map(function (_a) {
    var _b, _c;
    var id = _a[0], skill = _a[1];
    return ({
        id: id,
        name: skill.name || id,
        label: "".concat(skill.name || id, " / ").concat((_b = skill.element) !== null && _b !== void 0 ? _b : 'NONE', " / ").concat(skill.type, " / MP").concat((_c = skill.mpCost) !== null && _c !== void 0 ? _c : 0),
    });
})
    .sort(function (a, b) { return a.name.localeCompare(b.name, 'ja') || a.id.localeCompare(b.id); });
function clampRatePercent(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.max(0, Math.min(100, value));
}
function rateToPercent(rate, tier) {
    var _a;
    var fallback = ((_a = NECROMANCE_RATE_BY_TIER[tier]) !== null && _a !== void 0 ? _a : 0.12) * 100;
    return clampRatePercent(typeof rate === 'number' && Number.isFinite(rate) ? rate * 100 : fallback);
}
function getSkillOptionsForValue(skillId) {
    if (!skillId || MASTER_SKILLS[skillId])
        return SKILL_OPTIONS;
    return __spreadArray([{ id: skillId, name: skillId, label: "\u672A\u767B\u9332: ".concat(skillId) }], SKILL_OPTIONS, true);
}
function normalizeSkillIds(value) {
    return Array.isArray(value) ? value.filter(function (id) { return typeof id === 'string'; }) : [];
}
function necromanceToJson(necromance) {
    return {
        captureRate: Number((clampRatePercent(necromance.captureRatePercent) / 100).toFixed(6)),
        allyCost: Math.max(1, Math.floor(necromance.allyCost || 1)),
        allyStats: necromance.allyStats,
        skillIds: necromance.skillIds.filter(Boolean),
    };
}
function formToJson(form) {
    var _a;
    var weaknesses = ELEMENTS.filter(function (el) { var _a; return ((_a = form.resistances[el]) !== null && _a !== void 0 ? _a : 0) < 0; });
    var resistancesCleaned = {};
    for (var _i = 0, ELEMENTS_1 = ELEMENTS; _i < ELEMENTS_1.length; _i++) {
        var el = ELEMENTS_1[_i];
        if (((_a = form.resistances[el]) !== null && _a !== void 0 ? _a : 0) !== 0) {
            resistancesCleaned[el] = form.resistances[el];
        }
    }
    return __assign(__assign(__assign({ id: form.id, name: form.name, nameJa: form.nameJa, nameEn: form.nameEn, tier: form.tier, tribe: form.tribe, stats: form.stats, resistances: resistancesCleaned, weaknesses: weaknesses }, (form.shieldHp > 0 || form.maxShieldHp > 0
        ? { shieldHp: form.shieldHp, maxShieldHp: form.maxShieldHp }
        : {})), (form.gimmicks.length > 0
        ? { gimmicks: (0, gimmickValue_1.gimmickRowsToJson)(form.gimmicks) }
        : {})), { necromance: necromanceToJson(form.necromance), dropTable: form.dropTable, battle: form.battle, description: form.description });
}
function initForm(data, key) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
    if (!data) {
        return {
            id: key,
            name: '',
            nameJa: '',
            nameEn: '',
            tier: 'MINION',
            tribe: 'UNDEAD',
            description: '',
            stats: { hp: 10, atk: 4, def: 2, spd: 70, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 },
            resistances: {},
            shieldHp: 0,
            maxShieldHp: 0,
            gimmicks: [],
            necromance: {
                captureRatePercent: NECROMANCE_RATE_BY_TIER.MINION * 100,
                allyCost: NECROMANCE_COST_BY_TIER.MINION,
                allyStats: { hp: 10, atk: 4, def: 2, spd: 70, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 },
                skillIds: [],
            },
            dropTable: [],
            battle: { color: '#9ca3af', sprite: 'WRAITH', size: 0.72 },
        };
    }
    var raw = data;
    var stats = (_a = raw.stats) !== null && _a !== void 0 ? _a : {};
    var resistances = (_b = raw.resistances) !== null && _b !== void 0 ? _b : {};
    var battle = (_c = raw.battle) !== null && _c !== void 0 ? _c : {};
    var gimmicks = Array.isArray(raw.gimmicks)
        ? raw.gimmicks.map(function (g) { return ({
            trigger: typeof g.trigger === 'string' ? g.trigger : '',
            effect: typeof g.effect === 'string' ? g.effect : '',
            value: (0, gimmickValue_1.gimmickValueToInput)(g.value),
        }); })
        : [];
    var dropTable = (_d = raw.dropTable) !== null && _d !== void 0 ? _d : [];
    var tier = (_e = raw.tier) !== null && _e !== void 0 ? _e : 'MINION';
    var necromance = (_f = raw.necromance) !== null && _f !== void 0 ? _f : {};
    return {
        id: (_g = raw.id) !== null && _g !== void 0 ? _g : key,
        name: (_h = raw.name) !== null && _h !== void 0 ? _h : '',
        nameJa: (_j = raw.nameJa) !== null && _j !== void 0 ? _j : '',
        nameEn: (_k = raw.nameEn) !== null && _k !== void 0 ? _k : '',
        tier: tier,
        tribe: (_l = raw.tribe) !== null && _l !== void 0 ? _l : 'UNDEAD',
        description: (_m = raw.description) !== null && _m !== void 0 ? _m : '',
        stats: stats,
        resistances: resistances,
        shieldHp: (_o = raw.shieldHp) !== null && _o !== void 0 ? _o : 0,
        maxShieldHp: (_p = raw.maxShieldHp) !== null && _p !== void 0 ? _p : 0,
        gimmicks: gimmicks,
        necromance: {
            captureRatePercent: rateToPercent(necromance.captureRate, tier),
            allyCost: (_r = (_q = necromance.allyCost) !== null && _q !== void 0 ? _q : NECROMANCE_COST_BY_TIER[tier]) !== null && _r !== void 0 ? _r : 1,
            allyStats: (_s = necromance.allyStats) !== null && _s !== void 0 ? _s : stats,
            skillIds: normalizeSkillIds(necromance.skillIds),
        },
        dropTable: dropTable,
        battle: {
            color: (_t = battle.color) !== null && _t !== void 0 ? _t : '#9ca3af',
            sprite: (_u = battle.sprite) !== null && _u !== void 0 ? _u : 'WRAITH',
            size: (_v = battle.size) !== null && _v !== void 0 ? _v : 0.72,
        },
    };
}
function EnemyForm(_a) {
    var initialData = _a.initialData, entryKey = _a.entryKey, isNew = _a.isNew, itemIds = _a.itemIds, materialIds = _a.materialIds, _b = _a.dependencies, dependencies = _b === void 0 ? [] : _b;
    var router = (0, navigation_1.useRouter)();
    var _c = (0, react_1.useState)(TABS[0]), activeTab = _c[0], setActiveTab = _c[1];
    var _d = (0, react_1.useState)(function () { return initForm(initialData, entryKey); }), form = _d[0], setForm = _d[1];
    var _e = (0, react_1.useState)(false), saving = _e[0], setSaving = _e[1];
    var _f = (0, react_1.useState)(null), error = _f[0], setError = _f[1];
    var _g = (0, react_1.useState)(false), showSaveConfirm = _g[0], setShowSaveConfirm = _g[1];
    var _h = (0, react_1.useState)(false), showDeleteConfirm = _h[0], setShowDeleteConfirm = _h[1];
    var updateField = (0, react_1.useCallback)(function (key, val) {
        setForm(function (f) {
            var _a;
            return (__assign(__assign({}, f), (_a = {}, _a[key] = val, _a)));
        });
    }, []);
    var updateStat = (0, react_1.useCallback)(function (key, val) {
        setForm(function (f) {
            var _a;
            return (__assign(__assign({}, f), { stats: __assign(__assign({}, f.stats), (_a = {}, _a[key] = val, _a)) }));
        });
    }, []);
    var updateResistance = (0, react_1.useCallback)(function (el, val) {
        setForm(function (f) {
            var _a;
            return (__assign(__assign({}, f), { resistances: __assign(__assign({}, f.resistances), (_a = {}, _a[el] = val, _a)) }));
        });
    }, []);
    var updateGimmick = (0, react_1.useCallback)(function (idx, patch) {
        setForm(function (f) { return (__assign(__assign({}, f), { gimmicks: f.gimmicks.map(function (g, i) { return (i === idx ? __assign(__assign({}, g), patch) : g); }) })); });
    }, []);
    var updateNecromance = (0, react_1.useCallback)(function (patch) {
        setForm(function (f) { return (__assign(__assign({}, f), { necromance: __assign(__assign({}, f.necromance), patch) })); });
    }, []);
    var updateNecromanceStat = (0, react_1.useCallback)(function (key, val) {
        setForm(function (f) {
            var _a;
            return (__assign(__assign({}, f), { necromance: __assign(__assign({}, f.necromance), { allyStats: __assign(__assign({}, f.necromance.allyStats), (_a = {}, _a[key] = val, _a)) }) }));
        });
    }, []);
    function handleCopy() {
        navigator.clipboard.writeText(JSON.stringify(formToJson(form), null, 2));
    }
    function handleConfirmedSave() {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        setSaving(true);
                        setShowSaveConfirm(false);
                        return [4 /*yield*/, (0, actions_1.saveEntry)('enemies', form.id || entryKey, formToJson(form))];
                    case 1:
                        result = _b.sent();
                        setSaving(false);
                        if (result.success) {
                            router.push('/admin/enemies');
                        }
                        else {
                            setError((_a = result.error) !== null && _a !== void 0 ? _a : '保存に失敗しました');
                        }
                        return [2 /*return*/];
                }
            });
        });
    }
    function handleConfirmedDelete() {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        setSaving(true);
                        setShowDeleteConfirm(false);
                        return [4 /*yield*/, (0, actions_1.deleteEntry)('enemies', entryKey)];
                    case 1:
                        result = _b.sent();
                        setSaving(false);
                        if (result.success) {
                            router.push('/admin/enemies');
                        }
                        else {
                            setError((_a = result.error) !== null && _a !== void 0 ? _a : '削除に失敗しました');
                        }
                        return [2 /*return*/];
                }
            });
        });
    }
    var weaknesses = ELEMENTS.filter(function (el) { var _a; return ((_a = form.resistances[el]) !== null && _a !== void 0 ? _a : 0) < 0; });
    return (<div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      <FormSaveBar_1.default backHref="/admin/enemies" title={form.nameJa || form.name || (isNew ? '新規エネミー' : entryKey)} onSave={function () { return setShowSaveConfirm(true); }} onCopy={handleCopy} onDelete={!isNew ? function () { return setShowDeleteConfirm(true); } : undefined} saving={saving} isNew={isNew} entryKey={entryKey}/>

      {isNew && (<AIEnemyDraftPanel_1.default onApply={function (draft) {
                var draftId = typeof draft.id === 'string' && draft.id ? draft.id : entryKey;
                setForm(initForm(draft, draftId));
                setActiveTab(TABS[0]);
                setError(null);
            }}/>)}

      {error && (<div style={{
                background: 'rgba(127,29,29,0.3)',
                border: '1px solid rgba(220,38,38,0.4)',
                borderRadius: 6,
                padding: '10px 14px',
                color: '#fca5a5',
                fontSize: 14,
                marginBottom: 16,
            }}>
          {error}
        </div>)}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        <div>
          <FormTabs_1.default tabs={TABS} activeTab={activeTab} onChange={setActiveTab}/>

          {/* 基本情報 */}
          {activeTab === '基本情報' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField_1.default label="ID（キー）">
                <input type="text" value={form.id} onChange={function (e) { return updateField('id', e.target.value); }} disabled={!isNew} style={__assign(__assign({}, inputStyle), { opacity: isNew ? 1 : 0.5 })}/>
              </FormField_1.default>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField_1.default label="name (英語キー)">
                  <input type="text" value={form.name} onChange={function (e) { return updateField('name', e.target.value); }} style={inputStyle}/>
                </FormField_1.default>
                <FormField_1.default label="nameJa (日本語名)">
                  <input type="text" value={form.nameJa} onChange={function (e) { return updateField('nameJa', e.target.value); }} style={inputStyle}/>
                </FormField_1.default>
                <FormField_1.default label="nameEn (表示用英語)">
                  <input type="text" value={form.nameEn} onChange={function (e) { return updateField('nameEn', e.target.value); }} style={inputStyle}/>
                </FormField_1.default>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField_1.default label="Tier">
                  <select value={form.tier} onChange={function (e) { return updateField('tier', e.target.value); }} style={selectStyle}>
                    {TIERS.map(function (t) { return <option key={t} value={t}>{t}</option>; })}
                  </select>
                </FormField_1.default>
                <FormField_1.default label="Tribe（種族）">
                  <select value={form.tribe} onChange={function (e) { return updateField('tribe', e.target.value); }} style={selectStyle}>
                    {TRIBES.map(function (t) { return <option key={t} value={t}>{t}</option>; })}
                  </select>
                </FormField_1.default>
              </div>
              <FormField_1.default label="description">
                <textarea value={form.description} onChange={function (e) { return updateField('description', e.target.value); }} style={textareaStyle}/>
              </FormField_1.default>
            </div>)}

          {/* ステータス */}
          {activeTab === 'ステータス' && (<StatInputGrid_1.default value={form.stats} onChange={updateStat}/>)}

          {/* 属性耐性 */}
          {activeTab === '属性耐性' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ResistanceGrid_1.default value={form.resistances} onChange={updateResistance}/>
              {weaknesses.length > 0 && (<div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(127,29,29,0.15)', borderRadius: 8, border: '1px solid rgba(220,38,38,0.2)' }}>
                  <span style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif' }}>弱点（自動抽出）: </span>
                  <span style={{ color: '#fca5a5', fontSize: 12, fontFamily: 'monospace' }}>{weaknesses.join(', ')}</span>
                </div>)}
            </div>)}

          {/* ネクロマンス */}
          {activeTab === 'ネクロマンス' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField_1.default label="獲得確率 %">
                  <input type="number" value={form.necromance.captureRatePercent} onChange={function (e) { return updateNecromance({ captureRatePercent: clampRatePercent(parseFloat(e.target.value) || 0) }); }} min={0} max={100} step={0.001} style={inputStyle}/>
                </FormField_1.default>
                <FormField_1.default label="味方化後 cost">
                  <input type="number" value={form.necromance.allyCost} onChange={function (e) { return updateNecromance({ allyCost: parseInt(e.target.value) || 1 }); }} min={1} max={9} style={inputStyle}/>
                </FormField_1.default>
              </div>

              <div>
                <p style={{ color: '#7878a8', fontSize: 11, marginBottom: 10, fontFamily: 'Space Grotesk, sans-serif' }}>味方化後ステータス</p>
                <StatInputGrid_1.default value={form.necromance.allyStats} onChange={updateNecromanceStat}/>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif' }}>味方化後スキル</p>
                {form.necromance.skillIds.length === 0 ? (<p style={{ color: '#7878a8', fontSize: 12, fontStyle: 'italic' }}>スキルなし</p>) : (<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {form.necromance.skillIds.map(function (skillId, idx) { return (<div key={"".concat(skillId, "-").concat(idx)} style={{ display: 'grid', gridTemplateColumns: '1fr 32px', gap: 6, alignItems: 'center' }}>
                        <select value={skillId} onChange={function (e) { return updateNecromance({
                        skillIds: form.necromance.skillIds.map(function (id, i) { return (i === idx ? e.target.value : id); }),
                    }); }} style={selectStyle}>
                          <option value="">スキルを選択</option>
                          {getSkillOptionsForValue(skillId).map(function (skill) { return (<option key={skill.id} value={skill.id}>{skill.label}</option>); })}
                        </select>
                        <button type="button" onClick={function () { return updateNecromance({ skillIds: form.necromance.skillIds.filter(function (_, i) { return i !== idx; }) }); }} style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 12, width: 28, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          ×
                        </button>
                      </div>); })}
                  </div>)}
                <button type="button" onClick={function () { return updateNecromance({ skillIds: __spreadArray(__spreadArray([], form.necromance.skillIds, true), [''], false) }); }} style={{ background: 'rgba(139,0,255,0.10)', border: '1px dashed rgba(139,0,255,0.3)', color: '#8B00FF', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, alignSelf: 'flex-start' }}>
                  + スキルを追加
                </button>
              </div>
            </div>)}

          {/* ギミック */}
          {activeTab === 'ギミック' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField_1.default label="shieldHp">
                  <input type="number" value={form.shieldHp} onChange={function (e) { return updateField('shieldHp', parseInt(e.target.value) || 0); }} style={inputStyle}/>
                </FormField_1.default>
                <FormField_1.default label="maxShieldHp">
                  <input type="number" value={form.maxShieldHp} onChange={function (e) { return updateField('maxShieldHp', parseInt(e.target.value) || 0); }} style={inputStyle}/>
                </FormField_1.default>
              </div>
              <div>
                <p style={{ color: '#7878a8', fontSize: 11, marginBottom: 8, fontFamily: 'Space Grotesk, sans-serif' }}>ギミックテーブル</p>
                {form.gimmicks.length === 0 ? (<p style={{ color: '#7878a8', fontSize: 12, fontStyle: 'italic', marginBottom: 10 }}>ギミックなし</p>) : (<div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 32px', gap: 6 }}>
                      {['trigger', 'effect', 'value', ''].map(function (h) { return (<span key={h} style={{ color: '#7878a8', fontSize: 10, fontFamily: 'Space Grotesk, sans-serif' }}>{h}</span>); })}
                    </div>
                    {form.gimmicks.map(function (g, idx) { return (<div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 32px', gap: 6, alignItems: 'center' }}>
                        <select value={g.trigger} onChange={function (e) { return updateGimmick(idx, { trigger: e.target.value }); }} style={selectStyle}>
                          <option value="">（選択）</option>
                          {g.trigger && !GIMMICK_TRIGGERS.includes(g.trigger) && <option value={g.trigger}>未知: {g.trigger}</option>}
                          {GIMMICK_TRIGGERS.map(function (t) { return <option key={t} value={t}>{t}</option>; })}
                        </select>
                        <select value={g.effect} onChange={function (e) { return updateGimmick(idx, { effect: e.target.value }); }} style={selectStyle}>
                          <option value="">（選択）</option>
                          {g.effect && !GIMMICK_EFFECTS.includes(g.effect) && <option value={g.effect}>未知: {g.effect}</option>}
                          {GIMMICK_EFFECTS.map(function (e) { return <option key={e} value={e}>{e}</option>; })}
                        </select>
                        <input type="text" value={g.value} onChange={function (e) { return updateGimmick(idx, { value: e.target.value }); }} style={inputStyle} placeholder="1（数値）"/>
                        <button onClick={function () { return updateField('gimmicks', form.gimmicks.filter(function (_, i) { return i !== idx; })); }} style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 12, width: 28, height: 28 }}>×</button>
                      </div>); })}
                  </div>)}
                <button onClick={function () { return updateField('gimmicks', __spreadArray(__spreadArray([], form.gimmicks, true), [{ trigger: '', effect: '', value: '' }], false)); }} style={{ background: 'rgba(139,0,255,0.10)', border: '1px dashed rgba(139,0,255,0.3)', color: '#8B00FF', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                  + 行を追加
                </button>
              </div>
            </div>)}

          {/* ドロップ */}
          {activeTab === 'ドロップ' && (<DropTableEditor_1.default value={form.dropTable} onChange={function (entries) { return updateField('dropTable', entries); }} itemIds={itemIds} materialIds={materialIds}/>)}

          {/* 依存関係 */}
          {activeTab === '依存関係' && (<DependenciesTab_1.default refs={dependencies}/>)}

          {/* バトル表示 */}
          {activeTab === 'バトル' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField_1.default label="battle.color">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="color" value={form.battle.color} onChange={function (e) { return updateField('battle', __assign(__assign({}, form.battle), { color: e.target.value })); }} style={{ width: 48, height: 36, borderRadius: 4, cursor: 'pointer', border: '1px solid rgba(139,0,255,0.2)', background: 'transparent', padding: 2 }}/>
                  <input type="text" value={form.battle.color} onChange={function (e) { return updateField('battle', __assign(__assign({}, form.battle), { color: e.target.value })); }} style={__assign(__assign({}, inputStyle), { width: 120 })}/>
                </div>
              </FormField_1.default>
              <FormField_1.default label="battle.sprite">
                <select value={form.battle.sprite} onChange={function (e) { return updateField('battle', __assign(__assign({}, form.battle), { sprite: e.target.value })); }} style={selectStyle}>
                  {SPRITES.map(function (s) { return <option key={s} value={s}>{s}</option>; })}
                </select>
              </FormField_1.default>
              <FormField_1.default label="battle.size (0.5 〜 1.5)">
                <input type="number" value={form.battle.size} onChange={function (e) { return updateField('battle', __assign(__assign({}, form.battle), { size: parseFloat(e.target.value) || 0.72 })); }} min={0.5} max={1.5} step={0.01} style={inputStyle}/>
              </FormField_1.default>
            </div>)}
        </div>

        <JsonSidebar_1.default data={formToJson(form)}/>
      </div>

      <ConfirmDialog_1.default open={showSaveConfirm} title="保存の確認" message={"\"".concat(form.id || entryKey, "\" \u3092\u4FDD\u5B58\u3057\u307E\u3059\u3002\u30DE\u30B9\u30BF\u30FC\u30C7\u30FC\u30BF\u30D5\u30A1\u30A4\u30EB\u304C\u4E0A\u66F8\u304D\u3055\u308C\u307E\u3059\u3002")} onConfirm={handleConfirmedSave} onCancel={function () { return setShowSaveConfirm(false); }}/>
      <ConfirmDialog_1.default open={showDeleteConfirm} title="削除の確認" message={"\"".concat(entryKey, "\" \u3092\u524A\u9664\u3057\u307E\u3059\u3002\u3053\u306E\u64CD\u4F5C\u306F\u53D6\u308A\u6D88\u305B\u307E\u305B\u3093\u3002")} onConfirm={handleConfirmedDelete} onCancel={function () { return setShowDeleteConfirm(false); }} danger/>
    </div>);
}
