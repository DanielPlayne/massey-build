'use babel';

import MasseyBuildView from './massey-build-view';
import { CompositeDisposable } from 'atom';
import { parse, join } from 'path';
import { exec, execSync } from 'child_process';
import { _extend } from 'util';
const fs = require('fs'); 

  //   "uncondBuild": {
  //   "title": "Unconditional Build",
  //   "type": "boolean",
  //   "default": false,
  //   "order": 4,
  //   "description": "Will not check if executable is up to date"
  // },

export default {
  // Package Configuration Details
  "config": {
    "C": {
      "title": "C Compiler",
      "type": "string",
      "default": "gcc",
      "order": 1,
      "description": "Compiler for `C`, in full path or command name (make sure it is in your `$PATH`)"
    },
    "C++": {
      "title": "C++ Compiler",
      "type": "string",
      "default": "g++",
      "order": 2,
      "description": "Compiler for `C++`, in full path or command name (make sure it is in your `$PATH`)"
    },
    "make": {
      "title": "make",
      "type": "string",
      "default": "make",
      "order": 3,
      "description": "The `make` utility used for compilation, in full path or command name (make sure it is in your `$PATH`)"
    },
    "cflags": {
      "title": "Compiler Flags",
      "type": "string",
      "default": "-Wall",
      "order": 4,
      "description": "Flags for compiler, eg: `-Wall`"
    },
    "ldlibs": {
      "title": "Link Libraries",
      "type": "string",
      "default": "",
      "order": 5,
      "description": "Libraries for linking, eg: `-lm`"
    },
    "args": {
      "title": "Run Arguments",
      "type": "string",
      "default": "",
      "order": 6,
      "description": "Arguments for executing, eg: 1 2 3"
    },
    "ext": {
      "title": "Output Extension",
      "type": "string",
      "default": "",
      "order": 7,
      "description": "The output extension, eg: `out`, in Windows compilers will use `exe` by default"
    },
    "terminal": {
      "title": "Terminal Start Command (only Linux platform)",
      "type": "string",
      "default": "xterm -T $title -e",
      "order": 8,
      "description": "Customize the terminal start command, eg: `gnome-terminal -t $title -x bash -c`"
    },
    "debug": {
      "title": "Debug Mode",
      "type": "boolean",
      "default": false,
      "order": 9,
      "description": "Turn on this flag to log the executed command and output in console"
    }
  },

  masseyBuildView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.masseyBuildView = new MasseyBuildView(state.masseyBuildViewState);

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command
    this.subscriptions.add(atom.commands.add('atom-workspace', {
        'massey-build:build': () => this.build(false),
        'massey-build:rebuild': () => this.build(true),
        'massey-build:run': () => this.run()
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
    // this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.masseyBuildView.destroy();
  },

  serialize() {
    return {
      masseyBuildViewState: this.masseyBuildView.serialize()
    };
  },

  // Get file grammar (looking for C, C++, C++14, Makefile)
  getGrammar(grammar) {
    // Replace C++14 with C++
    grammar = (grammar == "C++14") ? "C++" : grammar;

    // Return Grammar
    return grammar;
  },

  // Get extention of target executable
  getExtension() {
    // Get Extension
    ext = atom.config.get("massey-build.ext");

    // Default Windows Extension
    if(!(typeof ext === "undefined") && ext != "") {
      return "." + ext;
    } else if(process.platform == "win32") {
      return ".exe";
    }
    return "";
  },

  // Get single-file target
  getCompileTarget(grammar, info) {
    console.log("getCompileTarget");
    if(grammar.match("C|C\\+\\+|C\\+\\+14")) {
      // Get Target Name
      return info.name + this.getExtension();
    }
  },

  // Get Makefile target
  getMakeTarget(grammar, info) {
    // Get Make Command
    make = atom.config.get("massey-build.make");

    // Read Makefile
    contents = fs.readFileSync(join(info.dir, info.base), 'utf8');

    // Get Makefile goals
    matches = [...contents.matchAll(/([A-Za-z0-9]+)([ \t]*):([ \t]*)([A-Za-z0-9_]*)/g)];

    // Return first goal
    return matches[0][matches[0].length-1];
  },

  getBuildType(grammar, info) {
    // Check Grammar
    if(grammar.match("C|C\\+\\+|C\\+\\+14")) {
      // Check if a Makefile exists in the directory
      if(fs.existsSync(join(info.dir, "makefile"))) {
        return "Makefile";
      } else if(fs.existsSync(join(info.dir, "Makefile"))) {
        return "Makefile";
      } else {
        return "Single";
      }
    } else if(grammar.match("Makefile")) {
      return "Makefile";
    }
  },

  // Get build target (single-file or Makefile)
  getBuildTarget(grammar, info) {
    console.log("getBuildTarget");

    // Check Grammar
    if(grammar.match("C|C\\+\\+|C\\+\\+14")) {
      // Check if a Makefile exists in the directory
      if(fs.existsSync(join(info.dir, "makefile"))) {
        // Use Makefile
        info.base = "makefile";

        // Get Make Target
        return this.getMakeTarget(grammar, info);
      } else if(fs.existsSync(join(info.dir, "Makefile"))) {
        // Use Makefile
        info.base = "Makefile";

        // Get Make Target
        return this.getMakeTarget(grammar, info);
      } else {
        // Get Compile Target
        return this.getCompileTarget(grammar, info) + this.getExtension();
      }
    } else if(grammar.match("Makefile")) {
      // Get Make Target
      return this.getMakeTarget(grammar, info);
    }
  },

  // ----------------------------------------
  // Compile - Compile (.c .cpp) / Make (Makefile)
  // ----------------------------------------
  // compile() {
  //   // Check that the selected pane is a TextEditor
  //   editor = atom.workspace.getActiveTextEditor();

  //   // Check Editor
  //   if(typeof editor === "undefined") {
  //     return;
  //   }

  //   // Check that the file is not temporary (user must save to an actual file first)
  //   if(typeof editor.getPath() === "undefined") {
  //     // Error - Save Temporary File
  //     atom.notifications.addError('File Not Saved', { detail: 'Temporary files must be saved first' });
  //     return
  //   }

  //   // Create Promise to save file
  //   Promise
  //     .resolve(editor.isModified() ? editor.save() : null)
  //     .then(() => {
  //       // Get Grammar from file
  //       grammar = this.getGrammar(editor.getGrammar().name)

  //       // Check Grammar is valid
  //       if(grammar.match("C|C\\+\\+|C\\+\\+14|Makefile") == null) {
  //         // Ignore file
  //         atom.notifications.addWarning(`Massey Build: Cannot build ${grammar} file`, {dismissable: true});
  //         return;
  //       }

  //       // Parse Path
  //       info = parse(editor.getPath());

  //       // Check Grammar
  //       if(grammar.match("C|C\\+\\+")) {
  //         // Compile File
  //         this.compileSingleFile(info);
  //       } else if(grammar.match("Makefile")) {
  //         // Make Project
  //         this.make(info);
  //       }
  //     }
  //   );
  // },

  build(rebuild) {
    // Check that the selected pane is a TextEditor
    editor = atom.workspace.getActiveTextEditor();
    if(typeof editor === "undefined") {
      return;
    }

    // Check that the file is not temporary (user must save to an actual file first)
    if(typeof editor.getPath() === "undefined") {
      atom.notifications.addError('File Not Saved', { detail: 'Temporary files must be saved first' });
      return
    }

    // Create Promise to save file
    Promise
      .resolve(editor.isModified() ? editor.save() : null)
      .then(() => {
        console.log("File saved");

        // Get Grammar from file
        grammar = this.getGrammar(editor.getGrammar().name);

        // Check Grammar is valid
        if(grammar.match("C|C\\+\\+|C\\+\\+14|Makefile") == null) {
          // Ignore file
          atom.notifications.addWarning(`Massey Build: Cannot build ${grammar} file`, {dismissable: true});
          return;
        }

        // Parse Path
        info = parse(editor.getPath());

        // Check grammar of file
        if(grammar.match("C|C\\+\\+")) {
          // Check if a Makefile exists in the directory
          if(fs.existsSync(join(info.dir, "makefile"))) {
            // Use Makefile
            info.base = "makefile";

            // Make Project
            this.make(info, rebuild);
          } else if(fs.existsSync(join(info.dir, "Makefile"))) {
            // Use Makefile
            info.base = "Makefile";

            // Make Project
            this.make(info, rebuild);
          } else {
            // Compile File
            this.compileSingleFile(info);
          }
        } else if(grammar.match("Makefile")) {
          // Make Project
          this.make(info, rebuild);
        }
      }
    );
  },

  escdq(s) {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  },

  // ----------------------------------------
  // Run
  // ----------------------------------------
  run() {
    // Check that the selected pane is a TextEditor
    editor = atom.workspace.getActiveTextEditor();
    if(typeof editor === "undefined") {
      return;
    }

    // Check that the file is not temporary (user must save to an actual file first)
    if(typeof editor.getPath() === "undefined") {
      atom.notifications.addError('File Not Saved', { detail: 'Temporary files must be saved first' });
      return
    }

    // Get Grammar from file
    grammar = this.getGrammar(editor.getGrammar().name);

    // Check Grammar is valid
    if(grammar.match("C|C\\+\\+|C\\+\\+14|Makefile") == null) {
      // Ignore file
      atom.notifications.addWarning(`Massey Build: Cannot build ${grammar} file`, {dismissable: true});
      return;
    }

    // Parse Path
    info = parse(editor.getPath());

    // Add project args to run time environment
    info.env = _extend({ ARGS: atom.config.get('massey-build.args') }, process.env);

    // Check grammar of file
    if(this.getBuildType(grammar, info) == "Single") {
      // Get Target
      info.exe = this.getBuildTarget(grammar, info);
    } else if(this.getBuildType(grammar, info) == "Makefile") {
      // Get Target
      info.exe = this.getBuildTarget(grammar, info);
    }

    // Check Platform
    if(process.platform == "win32") {
      // Windows - Run Command
      cmd = `start \"${info.exe}\" cmd /c \"\"${info.exe}\" ${info.env.ARGS} & pause\"`
    } else if(process.platform == "linux") {

    } else if(process.platform == "darwin") {
      // Mac OS X - Run Command
      cmd = "osascript -e \'tell application \"Terminal\" to activate do script \"" +
            this.escdq(`clear && cd \"${info.dir}\"; \"./${info.exe}\" ${info.env.ARGS}; ` +
            'read -n1 -p "" && osascript -e "tell application \\"Atom\\" to activate" && osascript -e "do shell script ' +
            this.escdq(`\"osascript -e ${this.escdq('"tell application \\"Terminal\\" to close windows 0"')} + &> /dev/null &\"`) +
            '"; exit') + '"\'';
    }

    Promise.resolve()
           .then(() => {
            console.log("then");
            if(this.getBuildType(grammar, info) == "Single") {
              // Get Target
              if(this.checkUpToDateSingleFile(info)) {
                return true;
              } else {
                // console.log(this.compileSingleFile(info));
                return this.compileSingleFile(info);
              }
            // } else if(this.getBuildType(grammar, info) == "Makefile") {
            } else {
              // Get Target
              if(this.checkUpToDateMake(info)) {
                return true;
              } else {
                // console.log(this.make(info));
                return this.make(info);
              }
            }
           })
           .then((built) => {
            console.log(built);
            if(built) {
              console.log("executing");
              console.log(cmd);

              // Execute Run Command
              exec(cmd, {cwd: info.dir, env: info.env}, (error, stdout, stderr) => {
                // Do Nothing?
                console.log(error);
                console.log(stdout);
                console.log(stderr);
              });
            } 
           });

    // Promise.resolve(() => {
    //   (this.getBuildType(grammar, info) == "Single") ? this.checkUpToDateSingleFile(info) : this.checkUpToDateMake(info)
    // }).then((val) => {
    //   console.log(val);
    // });

    // Promise.resolve(this.getBuildType(grammar, info))
    // promise = new Promise(
    //   () => {
    //     built = true;
    //     if(this.getBuildType(grammar, info) == "Single") {
    //       // Get Target
    //       built = this.checkUpToDateSingleFile(info);

    //       if(built == false) {
    //         built = this.compileSingleFile(info);
    //       }
    //     } else if(this.getBuildType(grammar, info) == "Makefile") {
    //       // Get Target
    //       built = this.checkUpToDateMake(info);

    //       if(built == false) {
    //         built = this.make(info);
    //       }
    //     }
    //     console.log(`Resolve ${built}`);

    //     return built;
    //   }
    // ).then(function(built) {
    //   console.log("Then");
    //   console.log(built);
    //   // if(built == true) {
    //   //   // Execute Run Command
    //   //   exec(cmd, {cwd: info.dir, env: info.env}, (error, stdout, stderr) => {
    //   //     // Do Nothing?
    //   //   });
    //   // }
    // });
  },

    // Promise.resolve(function() {
    //   built = true;
    //   if(this.getBuildType(grammar, info) == "Single") {
    //     // Get Target
    //     built = this.checkUpToDateSingleFile(info);

    //     if(built == false) {
    //       built = this.compileSingleFile(info);
    //     }
    //   } else if(this.getBuildType(grammar, info) == "Makefile") {
    //     // Get Target
    //     built = this.checkUpToDateMake(info);

    //     if(built == false) {
    //       built = this.make(info);
    //     }
    //   }
    //   console.log("Resolve");

    //   console.log(built);
    //   return built;
    // }).then(function(built) {
    //   console.log("Then");
    //   console.log(built);
    //   // if(built == true) {
    //   //   // Execute Run Command
    //   //   exec(cmd, {cwd: info.dir, env: info.env}, (error, stdout, stderr) => {
    //   //     // Do Nothing?
    //   //   });
    //   // }
    // });
  // },

  // Check if executable is up to date (single file)
  checkUpToDateSingleFile(info) {
    // Get source file timestamp
    sourceTime = fs.statSync(join(info.dir, info.base)).mtime.getTime();

    try {
      // Get executable timestamp
      targetTime = fs.statSync(join(info.dir, info.exe)).mtime.getTime();
    } catch (error) {
      targetTime = 0;

      return false;
    }

    // Compare Timestamps
    if(sourceTime > targetTime) {
      // Show Warning
      atom.notifications.addWarning(`Executable out of date`,
                                    {details:     `${info.base} has been modified since ${info.exe} was built.`,
                                     dismissable: true});
      return false;
    }

    return true;
  },

  // Check if executable is up to date (Makefile)
  checkUpToDateMake(info) {
    console.log("checkUpToDateMake");

    // Get make command
    make = atom.config.get('massey-build.make');

    // Generate make command
    checkcmd = `\"${make}\" -q -f \"${info.base}\"`

    // Execute Build Command
    try {
      execSync(checkcmd, { cwd: info.dir });

    } catch(error) {
      console.log(error);

      // atom.notifications.addWarning(`Executable out of date`,
      //                               {details:     `${info.base} has been modified since ${info.exe} was built.`,
      //                                dismissable: true});
      return false;
    }
    return true;
  },

  // ----------------------------------------
  // Make
  // ----------------------------------------
  // Builds a file/project with a makefile
  // 1. Get Make Utility
  // 2. Generate Make Command
  // 3. Execute Make Command
  // 4. Check Results (show Error/Warning/Success)
  make(info, rebuild) {
    // Log
    console.log("Make: " + info.base);

    // Get make command
    make = atom.config.get('massey-build.make');

    // Make flags (force build)
    flags = (rebuild) ? "-B" : "";

    // Generate make command
    buildcmd = `\"${make}\" ${flags} -f \"${info.base}\"`

    // Notify that compiling is starting
    atom.notifications.addInfo('Building...', { detail: buildcmd })

     try {
      // Execute Compile Command
      execSync(buildcmd, { cwd: info.dir });

      // Notify Build Success
      atom.notifications.addSuccess("Build Success");
    } catch(error) {
      // Notify Build Error
      atom.notifications["addError"]("Error: ", {detail: error, dismissable: true});

      // Build Failed
      return false;
    }

    // Build Succeeded
    return true;
  },


  // ----------------------------------------
  // Compile
  // ----------------------------------------
  compileSingleFile(info) {
    // Get Compiler
    compiler = atom.config.get("massey-build." + grammar);

    // Get Extension
    ext = atom.config.get("massey-build.ext");

    // Get Target
    info.exe = this.getBuildTarget(grammar, info);

    // Default Windows Extension
    if(!(typeof ext === "undefined") && ext != "") {
      info.exe += "." + ext;
    } else if(process.platform == "win32") {
      info.exe += ".exe";
    }

    // Get Flags
    cflags = atom.config.get("massey-build.cflags");
    ldlibs = atom.config.get("massey-build.ldlibs");

    // Generate Compile Command
    buildcmd = `\"${compiler}\" ${cflags} \"${info.base}\" -o \"${info.exe}\" ${ldlibs}`;

    // Notify that compiling is starting
    atom.notifications.addInfo('Compiling...', { detail: buildcmd })
    
    try {
      // Execute Compile Command
      execSync(buildcmd, { cwd: info.dir });

      // Notify Build Success
      atom.notifications.addSuccess("Build Success");
    } catch(error) {
      // Notify Build Error
      atom.notifications["addError"]("Error: ", {detail: error, dismissable: true});
      
      // Build Failed
      return false;
    }

    // Build Succeeded
    return true;
  }
};
