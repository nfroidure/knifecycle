<a name="2.5.2"></a>
## [2.5.2](https://github.com/nfroidure/knifecycle/compare/v2.5.1...v2.5.2) (2018-05-06)


### Bug Fixes

* **Tests:** Fix tests for Node10 ([b3511a4](https://github.com/nfroidure/knifecycle/commit/b3511a4))



<a name="2.5.1"></a>
## [2.5.1](https://github.com/nfroidure/knifecycle/compare/v2.5.0...v2.5.1) (2018-04-13)



<a name="2.5.0"></a>
# [2.5.0](https://github.com/nfroidure/knifecycle/compare/v2.4.2...v2.5.0) (2018-03-21)


### Bug Fixes

* **Build:** Fix build for providers ([2847929](https://github.com/nfroidure/knifecycle/commit/2847929))


### Features

* **API:** Ensure existing initializer type are provided ([bf880d9](https://github.com/nfroidure/knifecycle/commit/bf880d9))



<a name="2.4.2"></a>
## [2.4.2](https://github.com/nfroidure/knifecycle/compare/v2.4.1...v2.4.2) (2017-12-02)



<a name="2.4.1"></a>
## [2.4.1](https://github.com/nfroidure/knifecycle/compare/v2.4.0...v2.4.1) (2017-11-07)



<a name="2.4.0"></a>
# [2.4.0](https://github.com/nfroidure/knifecycle/compare/v2.3.0...v2.4.0) (2017-11-07)


### Features

* **Build:** Allow to build initialization modules ([1aaca1b](https://github.com/nfroidure/knifecycle/commit/1aaca1b))



<a name="2.3.0"></a>
# [2.3.0](https://github.com/nfroidure/knifecycle/compare/v2.2.2...v2.3.0) (2017-10-30)


### Bug Fixes

* **Build:** Fix frontend tests for Firefox ([890227b](https://github.com/nfroidure/knifecycle/commit/890227b))


### Features

* **Extra:** Allow to add extra informations to initializers ([782bade](https://github.com/nfroidure/knifecycle/commit/782bade)), closes [#41](https://github.com/nfroidure/knifecycle/issues/41)



<a name="2.2.2"></a>
## [2.2.2](https://github.com/nfroidure/knifecycle/compare/v2.2.1...v2.2.2) (2017-10-24)


### Bug Fixes

* **Build:** Quick fix of the build ([0b71c08](https://github.com/nfroidure/knifecycle/commit/0b71c08))



<a name="2.2.1"></a>
## [2.2.1](https://github.com/nfroidure/knifecycle/compare/v2.2.0...v2.2.1) (2017-10-24)


### Bug Fixes

* **Services mapping:** Fix deep service mapping ([9445cc3](https://github.com/nfroidure/knifecycle/commit/9445cc3))


### Features

* **Browser:** Add browser support ([d268fbd](https://github.com/nfroidure/knifecycle/commit/d268fbd))



<a name="2.2.0"></a>
# [2.2.0](https://github.com/nfroidure/knifecycle/compare/v2.1.1...v2.2.0) (2017-07-30)


### Features

* **Decorators:** Add the ability to create a initializer from simple function ([f9e505e](https://github.com/nfroidure/knifecycle/commit/f9e505e)), closes [#37](https://github.com/nfroidure/knifecycle/issues/37)



<a name="2.1.1"></a>
## [2.1.1](https://github.com/nfroidure/knifecycle/compare/v2.1.0...v2.1.1) (2017-06-15)


### Bug Fixes

* **Mappings:** Fix the mappings for the initial run ([2cfdb7f](https://github.com/nfroidure/knifecycle/commit/2cfdb7f))



<a name="2.1.0"></a>
# [2.1.0](https://github.com/nfroidure/knifecycle/compare/v2.0.0...v2.1.0) (2017-06-04)


### Features

* **Util:** Add a function to decorate initializers ([477ad14](https://github.com/nfroidure/knifecycle/commit/477ad14))



<a name="2.0.0"></a>
# [2.0.0](https://github.com/nfroidure/knifecycle/compare/v1.4.0...v2.0.0) (2017-05-28)


### Code Refactoring

* **Decorators:** Isolated decorators code ([a776ab8](https://github.com/nfroidure/knifecycle/commit/a776ab8)), closes [#28](https://github.com/nfroidure/knifecycle/issues/28) [#32](https://github.com/nfroidure/knifecycle/issues/32)
* **Dependencies:** Change depends to be a Knifecycle static property ([a35f5ca](https://github.com/nfroidure/knifecycle/commit/a35f5ca)), closes [#24](https://github.com/nfroidure/knifecycle/issues/24)
* **Dependencies declarations:** Change the dependencies mapping symbol fron `:` to `>`. ([9744aeb](https://github.com/nfroidure/knifecycle/commit/9744aeb)), closes [#26](https://github.com/nfroidure/knifecycle/issues/26)
* **Providers:** Simplify the service providers signature ([7f5fef3](https://github.com/nfroidure/knifecycle/commit/7f5fef3)), closes [#30](https://github.com/nfroidure/knifecycle/issues/30)
* **Services:** Do not support services as a promise anymore ([af31c0d](https://github.com/nfroidure/knifecycle/commit/af31c0d))


### Features

* **Options:** Add a decorator to specify service provider options ([867f427](https://github.com/nfroidure/knifecycle/commit/867f427))


### BREAKING CHANGES

* Dependencies declarations: Break 1.0 mappings
* Decorators: Every 1.0 code will break since the `index.js` exports were broken.
* Dependencies: Will break almost every 1.0 things
* Providers: Almost every providers written before will not work anymore
* Services: It is not possible to use a promise while declaring a service.



<a name="1.4.0"></a>
# [1.4.0](https://github.com/nfroidure/knifecycle/compare/v1.3.1...v1.4.0) (2017-05-22)


### Bug Fixes

* **Providers:** Allow services to have options too ([75bffcf](https://github.com/nfroidure/knifecycle/commit/75bffcf))
* **Singletons:** Ensure singletons aren't shut down ([1de26d6](https://github.com/nfroidure/knifecycle/commit/1de26d6))


### Features

* **Bad usage:** Fail on dependencies declaration for constant ([ab57c18](https://github.com/nfroidure/knifecycle/commit/ab57c18))
* **Dependencies declarations:** Allow to make some dependencies optional ([0944709](https://github.com/nfroidure/knifecycle/commit/0944709)), closes [#23](https://github.com/nfroidure/knifecycle/issues/23)
* **Providers:** Allow to declare providers as singletons ([dad9006](https://github.com/nfroidure/knifecycle/commit/dad9006)), closes [#3](https://github.com/nfroidure/knifecycle/issues/3)
* **Shutdown:** Allow to shutdown all silos ([7af87de](https://github.com/nfroidure/knifecycle/commit/7af87de))
* **Singletons:** Shutdown singletons when not used per any silo ([f953851](https://github.com/nfroidure/knifecycle/commit/f953851))



<a name="1.3.1"></a>
## [1.3.1](https://github.com/nfroidure/knifecycle/compare/v1.3.0...v1.3.1) (2017-03-14)



<a name="1.3.0"></a>
# [1.3.0](https://github.com/nfroidure/knifecycle/compare/v1.2.0...v1.3.0) (2017-03-08)


### Bug Fixes

* **mermaid:** Only apply first style ([d78ecd3](https://github.com/nfroidure/knifecycle/commit/d78ecd3))
* **package:** update yerror to version 2.0.0 ([5697a89](https://github.com/nfroidure/knifecycle/commit/5697a89))


### Features

* **mermaid:** Add the ability to generate dependencies graphs ([b2ac582](https://github.com/nfroidure/knifecycle/commit/b2ac582))
* **mermaid:** Allow to add styles to graphs ([520b7a1](https://github.com/nfroidure/knifecycle/commit/520b7a1))
* **mermaid:** Allow to shape Mermaid diagrams node ([ced9dad](https://github.com/nfroidure/knifecycle/commit/ced9dad))




### v1.2.0 (2017/01/31 16:46 +00:00)
- [320ee35](https://github.com/nfroidure/knifecycle/commit/320ee354d9fcdb6ee4d9b9689c609ed92f29ab2a) 1.2.0 (@nfroidure)
- [9e7bf18](https://github.com/nfroidure/knifecycle/commit/9e7bf180920fd9e640db01db4e58e5304ca77783) Supporting services names mapping fix #5 (@nfroidure)

### v1.1.3 (2016/12/28 09:12 +00:00)
- [e49a55b](https://github.com/nfroidure/knifecycle/commit/e49a55bf43016a09cf5f3007ecfa2b36fd4dd147) 1.1.3 (@nfroidure)
- [ff34afc](https://github.com/nfroidure/knifecycle/commit/ff34afc6fd1ee970fe11a6c29978db1839896d26) Drop old Node versions support (@nfroidure)

### v1.1.2 (2016/12/28 09:03 +00:00)
- [8a663e0](https://github.com/nfroidure/knifecycle/commit/8a663e037979eeed2f39384207367ec79dc57ec0) 1.1.2 (@nfroidure)
- [2ce95e2](https://github.com/nfroidure/knifecycle/commit/2ce95e20e7e77a26a617d8a2bc86fdab61e3bc40) Regenerating docs (@nfroidure)
- [ff1bf5e](https://github.com/nfroidure/knifecycle/commit/ff1bf5ee92a2fbf985e781a830da0e30804c198c) Fixing linting (@nfroidure)
- [f37a5d3](https://github.com/nfroidure/knifecycle/commit/f37a5d39ab28565ec23f5212fd33d67ad32ce7e9) Fixing shutdown order (@nfroidure)
- [#4](https://github.com/nfroidure/knifecycle/pull/4) Update dependencies to enable Greenkeeper 🌴 (@nfroidure)
- [b767a8b](https://github.com/nfroidure/knifecycle/commit/b767a8bd0040e11657180a4c661fb41f3294c407) chore(package): update dependencies (@greenkeeper[bot])

### v1.1.1 (2016/10/30 18:11 +00:00)
- [aeacef8](https://github.com/nfroidure/knifecycle/commit/aeacef8e45b7e9cf51cd2f8c1cff78420310cb58) 1.1.1 (@nfroidure)
- [844eed1](https://github.com/nfroidure/knifecycle/commit/844eed19d344047e5612d51af462459024004e40) Fixing typo (@nfroidure)

### v1.1.0 (2016/10/30 09:22 +00:00)
- [4d2db29](https://github.com/nfroidure/knifecycle/commit/4d2db296599a6c2eedc4f7f940a327049be98ab3) 1.1.0 (@nfroidure)
- [8346671](https://github.com/nfroidure/knifecycle/commit/8346671e95bc5cf00da8af35990a89adea2085f6) Adding an helper to get a Knifecycle instance easily (@nfroidure)
- [7b2408c](https://github.com/nfroidure/knifecycle/commit/7b2408c368aa786b218f6f426a501862c8619e6c) Adding the  service fix #2 (@nfroidure)

### v1.0.5 (2016/10/30 07:31 +00:00)
- [26d27ea](https://github.com/nfroidure/knifecycle/commit/26d27ea8d83f751edc5318997c14c2147bfebf75) 1.0.5 (@nfroidure)
- [ead7eee](https://github.com/nfroidure/knifecycle/commit/ead7eeeccbaeda699231ce348237eb420042349c) Fixing shutdown for multi used dependency fix #1 (@nfroidure)

### v1.0.4 (2016/09/02 13:08 +00:00)
- [b64a702](https://github.com/nfroidure/knifecycle/commit/b64a702437f8d0f721ea0fc6b2b9185294494ffb) 1.0.4 (@nfroidure)
- [22303b8](https://github.com/nfroidure/knifecycle/commit/22303b83c3ca78f8a521cb351d6149e36d907417) Better feedback when erroring (@nfroidure)

### v1.0.3 (2016/09/01 12:45 +00:00)
- [6e40f63](https://github.com/nfroidure/knifecycle/commit/6e40f63a8a0e6c72ce68876be21700d34ca73cc3) 1.0.3 (@nfroidure)
- [3ccc9c1](https://github.com/nfroidure/knifecycle/commit/3ccc9c1aacdb44e749fb55f07744350da3584273) Avoid instanciating services twice (@nfroidure)

### v1.0.2 (2016/08/31 09:52 +00:00)
- [4c5104a](https://github.com/nfroidure/knifecycle/commit/4c5104aed07ff0bcca137e3348be22652c5093c1) 1.0.2 (@nfroidure)
- [9db5519](https://github.com/nfroidure/knifecycle/commit/9db55197b1df9f2613c733e043047f3461be6521) Fixing service shutdown (@nfroidure)

### v1.0.1 (2016/08/29 13:56 +00:00)
- [f6f8b81](https://github.com/nfroidure/knifecycle/commit/f6f8b8173a1550a267262ee35a536df602fa85b4) 1.0.1 (@nfroidure)
- [bfce2c9](https://github.com/nfroidure/knifecycle/commit/bfce2c91884281cda99ef807d4a84c73dcd4092b) Fixing depends for services (@nfroidure)

### v1.0.0 (2016/08/27 15:17 +00:00)
- [f278cb7](https://github.com/nfroidure/knifecycle/commit/f278cb7a02c7ff5e56bb1f46b42527b8d05e09b7) 1.0.0 (@nfroidure)
- [648d7ff](https://github.com/nfroidure/knifecycle/commit/648d7ff067f9038b9a3bf82d21d72ae83d48bf03) Adding doc (@nfroidure)
- [160d086](https://github.com/nfroidure/knifecycle/commit/160d0867692688f42df2c40a012fb3f574079355) Adding project files (@nfroidure)
- [1ee0bff](https://github.com/nfroidure/knifecycle/commit/1ee0bff8d2cb65bc015e39307fa34da39465d7d3) Adding a LICENSE (@nfroidure)
- [dff2847](https://github.com/nfroidure/knifecycle/commit/dff284714c87857553dc47c45da93e03d76fbd60) Specifying node engine (@nfroidure)
- [acffe5a](https://github.com/nfroidure/knifecycle/commit/acffe5a53410672e7146036acc41b3837e86f879) Adding codeclimate config (@nfroidure)
- [97099fc](https://github.com/nfroidure/knifecycle/commit/97099fc9a7ccfb9fd84a3299ff6a6c594cf92144) Adding coveralss cfg file to git ignore (@nfroidure)
- [f32f016](https://github.com/nfroidure/knifecycle/commit/f32f016c24467f00f6e31fc217ed8412c0aaf120) Fixing the linter issues (@nfroidure)
- [461ecf6](https://github.com/nfroidure/knifecycle/commit/461ecf6773c4bb66a542d25d4debcc965c5fdb4e) Adding travis build (@nfroidure)
- [2243977](https://github.com/nfroidure/knifecycle/commit/22439773bc118b17fc4bd97873629d67ea71c587) Adding badges (@nfroidure)
- [caa3e4e](https://github.com/nfroidure/knifecycle/commit/caa3e4e5971cf9e4a14b6d9c7e55d2800b544bfb) Adding some usage infos and future plans (@nfroidure)
- [f7081a8](https://github.com/nfroidure/knifecycle/commit/f7081a88b6b87310d8c435db33f3cbd7e5858b4e) Adding the fatal error handler (@nfroidure)
- [05fa72a](https://github.com/nfroidure/knifecycle/commit/05fa72a11e9af321368ad7a5297bba77a0483272) First draft of a service injection tool for node (@nfroidure)
