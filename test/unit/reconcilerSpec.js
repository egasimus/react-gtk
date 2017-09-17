const sinon = require('sinon');
const { expect } = require('chai');

const createReconciler = require('../../src/reconciler');

describe('reconciler.js', function () {
    class ContainerStub {
        constructor() {
            this.add = sinon.stub();
            this.remove = sinon.stub();
        }
    }

    const getDefaultImports = () => ({
        gi: {
            Gtk: {
                Label: sinon.stub(),
                ApplicationWindow: sinon.stub(),
                Container: ContainerStub
            },
            GObject: {
                signal_lookup: sinon.stub()
            }
        }

    });
    const logStub = () => {};

    describe('creating instance', function () {
        it('should instance a type once', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);

            const instance = {};
            imports.gi.Gtk.Label.returns(instance);

            const gotInstance = Reconciler.createInstance('GtkLabel', {});

            expect(imports.gi.Gtk.Label.callCount).to.equal(1);
            expect(gotInstance).to.equal(instance);
        });

        it('should instance with properties', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);

            const instance = {};
            imports.gi.Gtk.Label.returns(instance);

            Reconciler.createInstance('GtkLabel', { some: 'prop' });

            expect(imports.gi.Gtk.Label.firstCall.args).to.deep.equal([ { some: 'prop' } ]);
        });

        it('should not set the children property', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);

            const instance = {};
            imports.gi.Gtk.Label.returns(instance);

            Reconciler.createInstance('GtkLabel', { some: 'prop', children: [] });

            expect(imports.gi.Gtk.Label.firstCall.args).to.deep.equal([ { some: 'prop' } ]);
        });

        it('should set signal handlers', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);

            const handleId = 111;
            const instance = { connect: sinon.stub().returns(handleId) };
            imports.gi.Gtk.Label.returns(instance);
            imports.gi.GObject.signal_lookup.withArgs('clicked', imports.gi.Gtk.Label).returns(124);

            const handler = () => ({});
            Reconciler.createInstance('GtkLabel', { onClicked: handler, children: [] });

            expect(instance.connect.firstCall.args).to.deep.equal([ 'clicked', handler ]);
            expect(instance._connectedSignals).to.deep.equal({ clicked: handleId });
        });

        it('should not set unknown signal handlers', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);

            const instance = { connect: sinon.stub() };
            imports.gi.Gtk.Label.returns(instance);
            imports.gi.GObject.signal_lookup.returns(0);

            Reconciler.createInstance('GtkLabel', { onSomething: () => {}, children: [] });

            expect(instance.connect.callCount).to.equal(0);
        });

        it('should set an application window if neccessary', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);

            const application = {};
            const instance = { my: 'app' };
            imports.gi.Gtk.ApplicationWindow.returns(instance);
            imports.gi.GObject.signal_lookup.returns(0);

            Reconciler.createInstance('GtkApplicationWindow', {}, application);

            expect(imports.gi.Gtk.ApplicationWindow.firstCall.args).to.deep.equal([ { application } ]);
        });
    });

    describe('adding first child', function () {
        it('should call show_all on the child', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);

            const parent = {};
            const child = { show_all: sinon.stub() };

            Reconciler.appendInitialChild(parent, child);

            expect(child.show_all.callCount).to.equal(1);
        });

        it('should add the child to a Container parent', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);

            const parent = new imports.gi.Gtk.Container();
            const child = { show_all: sinon.stub() };

            Reconciler.appendInitialChild(parent, child);

            expect(parent.add.callCount).to.equal(1);
            expect(parent.add.firstCall.args.length).to.equal(1);
            expect(parent.add.firstCall.args[0]).to.equal(child);
        });
    });

    describe('adding child', function () {
        it('should call show_all on the child', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);

            const parent = {};
            const child = { show_all: sinon.stub() };

            Reconciler.appendChild(parent, child);

            expect(child.show_all.callCount).to.equal(1);
        });

        it('should add the child to a Container parent', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);

            const parent = new imports.gi.Gtk.Container();
            const child = { show_all: sinon.stub() };

            Reconciler.appendChild(parent, child);

            expect(parent.add.callCount).to.equal(1);
            expect(parent.add.firstCall.args.length).to.equal(1);
            expect(parent.add.firstCall.args[0]).to.equal(child);
        });
    });

    describe('removing child', function () {
        it('should do nothing by default', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);

            const parent = {};
            const child = {};

            Reconciler.removeChild(parent, child);
        });

        it('should remove the child from a Container parent', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);

            const parent = new imports.gi.Gtk.Container();
            const child = {};

            Reconciler.removeChild(parent, child);

            expect(parent.remove.callCount).to.equal(1);
            expect(parent.remove.firstCall.args.length).to.equal(1);
            expect(parent.remove.firstCall.args[0]).to.equal(child);
        });
    });

    describe('preparing update', function () {
        it('should return null if props are equal', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);
            const oldProps = { props: 1 };
            const newProps = { props: 1 };

            expect(Reconciler.prepareUpdate(null, null, oldProps, newProps)).to.equal(null);
        });

        it('should return null if only children differ', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);
            const oldProps = { props: 1, children: [ 2 ] };
            const newProps = { props: 1, children: [ 1 ] };

            expect(Reconciler.prepareUpdate(null, null, oldProps, newProps)).to.equal(null);
        });

        it('should return set when a prop differs from old prop', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);
            const oldProps = { prop: 1, children: [ 2 ] };
            const newProps = { prop: 2, children: [ 1 ] };

            expect(Reconciler.prepareUpdate(null, null, oldProps, newProps)).to.deep.equal({
                set: [
                    [ 'prop', 2 ]
                ],
                unset: []
            });
        });

        it('should return unset a prop was removed', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);
            const oldProps = { prop1: 1, prop2: 1 };
            const newProps = { prop1: 1 };

            expect(Reconciler.prepareUpdate(null, null, oldProps, newProps)).to.deep.equal({
                set: [],
                unset: [ 'prop2' ]
            });
        });
    });

    describe('committing update', function () {
        it('should set properties', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);
            const instance = { prop1: 1 };
            const changes = { set: [ [ 'prop1', 2 ] ], unset: [] };

            imports.gi.GObject.signal_lookup.returns(0);
            Reconciler.commitUpdate(instance, changes);

            expect(instance.prop1).to.equal(2);
        });

        it('should unset properties', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);
            const instance = { prop1: 1 };
            const changes = { set: [], unset: [ 'prop1' ] };

            imports.gi.GObject.signal_lookup.returns(0);
            Reconciler.commitUpdate(instance, changes);

            expect(instance.prop1).to.equal(null);
        });

        it('should set signal handlers', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);
            const instance = { connect: sinon.stub().returns(124) };
            const onClicked = () => 'on clicked';
            const changes = { set: [ [ 'onClicked', onClicked ] ], unset: [] };

            imports.gi.GObject.signal_lookup.withArgs('clicked', instance).returns(1);
            Reconciler.commitUpdate(instance, changes);

            expect(instance.connect.callCount).to.equal(1);
            expect(instance.connect.firstCall.args).to.deep.equal([ 'clicked', onClicked ]);
            expect(instance._connectedSignals).to.deep.equal({ clicked: 124 });
        });

        it('should update signal handlers', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);
            const instance = {
                connect: sinon.stub().returns(124),
                disconnect: sinon.spy(),
                _connectedSignals: { clicked: 125 }
            };
            const onClicked = () => 'on clicked';
            const changes = { set: [ [ 'onClicked', onClicked ] ], unset: [] };

            imports.gi.GObject.signal_lookup.withArgs('clicked', instance).returns(124);
            Reconciler.commitUpdate(instance, changes);

            expect(instance.connect.callCount).to.equal(1);
            expect(instance.connect.firstCall.args).to.deep.equal([ 'clicked', onClicked ]);
            expect(instance.disconnect.callCount).to.equal(1);
            expect(instance.disconnect.firstCall.args).to.deep.equal([ 125 ]);
            expect(instance._connectedSignals).to.deep.equal({ clicked: 124 });
        });

        it('should remove signal handlers', function () {
            const imports = getDefaultImports();
            const Reconciler = createReconciler(imports, logStub);
            const instance = {
                disconnect: sinon.spy(),
                _connectedSignals: { clicked: 125 }
            };
            const changes = { set: [], unset: [ 'onClicked' ] };

            imports.gi.GObject.signal_lookup.withArgs('clicked', instance).returns(124);
            Reconciler.commitUpdate(instance, changes);

            expect(instance.disconnect.callCount).to.equal(1);
            expect(instance.disconnect.firstCall.args).to.deep.equal([ 125 ]);
            expect(instance._connectedSignals).to.deep.equal({});
        });
    });
});
