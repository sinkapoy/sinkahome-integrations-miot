import { icons } from '@sinkapoy/home-integrations-vue-components';
import sweeping from './sweeping/sweeping.svg';
import sweepingMopping from './sweeping/sweeping-mopping.svg';
import mopping from './sweeping/mopping.svg';
import silent from './sweeping/suction-0.svg';
import standart from './sweeping/suction-1.svg';
import medium from './sweeping/suction-2.svg';
import turbo from './sweeping/suction-3.svg';

import water0 from './water/water-0.svg';
import water1 from './water/water-1.svg';
import water2 from './water/water-2.svg';

icons['sweep'] = sweeping;
icons['sweepAndMop'] = sweepingMopping;
icons['mop'] = mopping;

icons['silent'] = silent;
icons['standart'] = standart;
icons['medium'] = medium;
icons['turbo'] = turbo;
    
export const waterIcons = {
    'low': water0,
    'mid': water1,
    'high': water2,
};
    