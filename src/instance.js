/* Architecture Note #1.2: One instance to rule them all

We almost never need to use several Knifecycle instances.
 This is why we are providing the `knifecycle/instance`
 module that give a direct access to a lazy instanciated
 `Knifecycle` instance.

At the same time, I prefer choosing when instantiating a
 singleton this is why I decided to not do it on the behalf
 of the developers by instead providing an opt-in interface
 to this singleton.
*/
import Knifecycle from './index';

const $ = Knifecycle.getInstance();

export default $;
