import {
    BehaviorSubject,
    timer
} from 'rxjs';

import {
    gearData
} from "./dataImporter";

import {
    debounce
} from "rxjs/operators";

const stats$ = new BehaviorSubject();
let stats = {
    Offensive: {},
    Defensive: {},
    Utility: {},
    Brands: {},
    Cores: {
        Offensive: 0,
        Defensive: 0,
        Utility: 0,
    },
    brands: {},
    cores: []
};

const keyBy = (array, key) => (array || []).reduce((r, x) => ({ ...r, [key ? x[key] : x]: x }), {});

class StatsService {
    brandSetBonuses = null;
    statsMapping = null;

    resetStats() {
        stats = {
            Offensive: {},
            Defensive: {},
            Utility: {},
            Brands: {},
            Cores: {
                Offensive: 0,
                Defensive: 0,
                Utility: 0,
            },
            brands: {},
            cores: []
        };
    }

    getStats$() {
        return stats$.asObservable()
            .pipe(debounce(() => timer(150)));
    }

    async updateStats(data) {
        this.resetStats()
        this.brandSetBonuses = this.brandSetBonuses || await gearData.BrandSetBonuses;
        if (!this.statsMapping) {
            const statsMapping = await gearData.StatsMapping
            this.statsMapping = this.statsMapping || keyBy(statsMapping, 'Stat');
        }
        this.addStatsFromGear(data.gear);

        if (data.specialization) {
            this.addStatsFromSpecialization(data.specialization);
        }

        this.handleBrandEdgeCase(stats.brands);

        stats$.next(stats);
    }

    addStatsFromWeapon(weapon) { }

    async addStatsFromGear(gearArr) {
        const statTypes = {
            'O': 'Offensive',
            'D': 'Defensive',
            'U': 'Utility',
        }
        for (let i = 0; i < gearArr.length; i++) {
            const gear = gearArr[i];
            if (gear) {
                // Add to brands OBJ
                stats.brands[gear.brand] = stats.brands[gear.brand] || []
                stats.brands[gear.brand].push(null);
                if (gear.core) {
                    stats.Cores[statTypes[gear.core.Type]]++;
                }
                const keys = ['attributeOne', 'attributeTwo', 'mod',]
                for (let keyI = 0; keyI < keys.length; keyI++) {
                    const key = keys[keyI];
                    const stat = gear[key]
                    if (stat) {
                        const val = stat.StatValue || Number(stat.Max);
                        const prevVal = stats[statTypes[stat.Type]][stat.Stat] || 0;
                        stats[statTypes[stat.Type]][stat.Stat] = prevVal + val;
                    }
                }
                if (this.isEdgeCaseGear(gear)) {
                    this.handleWearableEdgeCase(gear)
                }
            }
        }

        for (const brand in stats.brands) {
            // eslint-disable-next-line
            if (stats.brands.hasOwnProperty(brand)) {
                const brandCount = stats.brands[brand].length;
                for (let idx = 0; idx < brandCount; idx++) {
                    const found = this.brandSetBonuses.find(
                        b => b.Brand == `${brand}${idx}`
                    )
                    if (found) {
                        stats.brands[brand][idx] = `${found.stat} ${found.val}`;
                        const statType = this.statsMapping[found.stat].Type;
                        const prevVal = stats[statTypes[statType]][found.stat] || 0;
                        stats[statTypes[statType]][found.stat] = prevVal + Number(found.val);
                    }
                }
            }
        }
        console.log(stats)
    }

    edgeCaseGear = ["Acosta's Go-Bag"]
    isEdgeCaseGear(gear) {
        return this.edgeCaseGear.includes(gear.itemName);
    }

    handleWearableEdgeCase(wearable, wearableEdgeCaseID) {
        switch (wearableEdgeCaseID) {
            case 0:
                stats.brands['Exotic'][1] = 'Repair Skills  +10%';
                stats.brands['Exotic'][2] = 'Status Effects +10%';
                addValueToStat(stats.Utility, 'Status Effects', 10)
                addValueToStat(stats.Utility, 'Repair Skills', 10)
                break;
            default:
                break;
        }
    }

    edgeCaseBrands = ['Empress International']
    handleBrandEdgeCase(brands) {
        for (let i = 0; i < this.edgeCaseBrands.length; i++) {
            const edgeCaseBrand = this.edgeCaseBrands[i];
            if (brands[edgeCaseBrand]) {
                switch (edgeCaseBrand) {
                    case 'Empress International':
                        if (brands[edgeCaseBrand].length > 2) {
                            const skillEfficencyBuffs = ['Status Effects', 'Repair Skills', 'Skill Damage', 'Skill Health', 'Skill Haste']
                            skillEfficencyBuffs.forEach((val) => {
                                addValueToStat(stats.Utility, val, 10)
                            })
                        }
                        break;
                    default:
                        break;
                }
            }
        }
    }

    addStatsFromSpecialization(specialization) {
        // if there is a specialization, add +15 to all weapons
        [
            'Assault Rifle Damage',
            'LMG Damage',
            'Marksman Rifle Damage',
            'Pistol Damage',
            'Rifle Damage',
            'Shotgun Damage',
            'SMG Damage'
        ].forEach((dmg) => {
            addValueToStat(stats.Offensive, dmg, 15)
        })

        if (specialization.name.includes('Technician')) {
            stats.Cores.Utility++
            if (specialization.name.includes('Damage')) {
                addValueToStat(stats.Utility, 'Skill Damage', 10)
            } else {
                addValueToStat(stats.Utility, 'Repair Skills', 10)
            }
        }
    }
}


function addValueToStat(statToIncrease, key, value) {
    statToIncrease[key] = statToIncrease[key] ? statToIncrease[key] + value : value;
}

const statsService = new StatsService();

export default statsService;