// Needing several Lifecycle instances is a rare usecase so we are providing
// a singleton to simplify developpers usage
import Knifecycle from './index';

const $ = Knifecycle.getInstance();

export default $;
