'use babel';

import MasseyBuildView from './massey-build-view';
import { CompositeDisposable } from 'atom';

export default {

  masseyBuildView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.masseyBuildView = new MasseyBuildView(state.masseyBuildViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.masseyBuildView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command
    this.subscriptions.add(atom.commands.add('atom-workspace', {
        'massey-build:toggle': () => this.toggle(),
        'massey-build:compile': () => this.compile()
    }));



    // this.subscriptions.add(
    //     atom.commands.add('atom-workspace', 'massey-build:compile', () -> compile())
    // )

    // Register command that toggles this view
    // this.subscriptions.add(atom.commands.add('atom-workspace', {
    //   'massey-build:toggle': () => this.toggle()
    // }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.masseyBuildView.destroy();
  },

  serialize() {
    return {
      masseyBuildViewState: this.masseyBuildView.serialize()
    };
  },

  toggle() {
    console.log('MasseyBuild was toggled!');
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  },

  compile() {
      console.log('Compile')
  },

  run() {

  },

  make() {

  }

};
