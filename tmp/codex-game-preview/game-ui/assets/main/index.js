System.register("chunks:///_virtual/BoardGeometry.ts", ['cc'], function (exports) {
  var cclegacy, UITransform, Vec3, Vec2;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
      UITransform = module.UITransform;
      Vec3 = module.Vec3;
      Vec2 = module.Vec2;
    }],
    execute: function () {
      cclegacy._RF.push({}, "e078bVnTbNHbYr94lmHfESS", "BoardGeometry", undefined);
      // 棋盘几何计算集中在这里，避免玩法流程到处关心 BoardFill 尺寸和坐标换算细节。
      var BoardGeometry = exports('BoardGeometry', /*#__PURE__*/function () {
        function BoardGeometry(ownerNode, options) {
          this.options = void 0;
          this.ownerNode = ownerNode;
          this.options = options;
        }

        // UI 布局可能在运行时同步，外部属性变化后通过这里刷新几何参数。
        var _proto = BoardGeometry.prototype;
        _proto.updateOptions = function updateOptions(options) {
          this.options = options;
        }

        // 单格步长 = 棋子尺寸 + 列间距，这是所有坐标换算的基础。
        ;

        _proto.getStepSize = function getStepSize() {
          return this.options.pieceSize + this.options.spacing;
        };
        _proto.isInsideBoard = function isInsideBoard(row, column) {
          return row >= 0 && row < this.options.boardHeight && column >= 0 && column < this.options.boardWidth;
        }

        /**
         * 把触摸点换算成列索引。
         *
         * 先用棋盘节点的世界包围盒过滤棋盘外触摸，再转换到当前节点本地坐标，
         * 最后基于实时网格原点计算列，避免 BoardFill 尺寸变化后落列偏移。
         *
         * @param event Cocos 触摸事件。
         * @returns 有效列索引；触摸不在棋盘内时返回 -1。
         */;
        _proto.getColumnFromTouch = function getColumnFromTouch(event) {
          var uiLocation = event.getUILocation();
          // 棋盘外的触摸不参与列选择，避免底栏、状态栏等区域误触发加速下落。
          if (!this.isTouchInsideBoard(uiLocation.x, uiLocation.y)) {
            return -1;
          }
          var local = this.getLocalPositionFromTouch(event);
          if (!local) {
            return -1;
          }
          var column = Math.round((local.x - this.getBoardGridOriginX()) / this.getStepSize());
          return Math.max(0, Math.min(this.options.boardWidth - 1, column));
        }

        /**
         * 把触摸点换算成棋盘格子坐标。
         *
         * 交换、锤子和炸弹技能都会依赖这个结果判断目标格子，所以这里会同时校验触摸区域、
         * 本地坐标转换结果和棋盘行列边界。
         *
         * @param event Cocos 触摸事件。
         * @returns 合法棋盘格子坐标；触摸无效时返回 null。
         */;
        _proto.getCellFromTouch = function getCellFromTouch(event) {
          var uiLocation = event.getUILocation();
          if (!this.isTouchInsideBoard(uiLocation.x, uiLocation.y)) {
            return null;
          }
          var local = this.getLocalPositionFromTouch(event);
          if (!local) {
            return null;
          }
          var step = this.getStepSize();
          var column = Math.round((local.x - this.getBoardGridOriginX()) / step);
          var row = Math.round((local.y - this.getBoardGridOriginY()) / step);
          if (!this.isInsideBoard(row, column)) {
            return null;
          }
          return {
            row: row,
            column: column
          };
        }

        // Cocos 触摸坐标先从 UI 坐标转成本节点坐标，所有棋盘操作都基于同一坐标系。
        ;

        _proto.getLocalPositionFromTouch = function getLocalPositionFromTouch(event) {
          var uiTransform = this.ownerNode.getComponent(UITransform);
          if (!uiTransform) {
            return null;
          }
          var uiLocation = event.getUILocation();
          return uiTransform.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0));
        }

        // 使用棋盘节点的世界包围盒判断触摸是否真的落在棋盘区域内。
        ;

        _proto.isTouchInsideBoard = function isTouchInsideBoard(x, y) {
          var _this$ownerNode$getCh;
          var boardTransform = (_this$ownerNode$getCh = this.ownerNode.getChildByName('board')) == null ? void 0 : _this$ownerNode$getCh.getComponent(UITransform);
          if (!boardTransform) {
            return false;
          }
          return boardTransform.getBoundingBoxToWorld().contains(new Vec2(x, y));
        }

        /**
         * 把棋盘中的行列坐标换成节点本地坐标。
         *
         * 所有落点、重力下落和合并动画都走同一套换算，保证逻辑坐标和 UI 表现对齐。
         *
         * @param row 棋盘行号，0 表示底行。
         * @param column 棋盘列号，0 表示最左列。
         * @returns 当前节点坐标系下的格子中心点。
         */;
        _proto.getCellPosition = function getCellPosition(row, column) {
          var step = this.getStepSize();
          // 从棋盘当前内区实时计算原点，避免边框或尺寸变化后边缘列跑出外框。
          return new Vec3(this.getBoardGridOriginX() + column * step, this.getBoardGridOriginY() + row * step, 0);
        }

        /**
         * 获取新棋子的出生点。
         *
         * x 轴与目标列严格对齐，y 轴放在棋盘顶部之外，让棋子生成后可以垂直下落进入棋盘。
         *
         * @param column 目标出生列。
         * @returns 当前节点坐标系下的出生位置。
         */;
        _proto.getSpawnPosition = function getSpawnPosition(column) {
          var step = this.getStepSize();
          // 出生点也复用同一套网格原点，保证生成后垂直落下时不会偏列。
          return new Vec3(this.getBoardGridOriginX() + column * step, this.getBoardGridOriginY() + this.options.boardHeight * step + this.options.spawnOffsetY, 0);
        }

        /**
         * 读取棋盘有效内区宽度。
         *
         * 优先读取 BoardFill，缺失时退回 board 节点尺寸并扣除边距，最后再使用格子步长兜底。
         * 这样棋盘装饰样式变化时，逻辑层仍以真实可落子区域为准。
         *
         * @returns 棋盘有效内区宽度。
         */;
        _proto.getBoardInnerWidth = function getBoardInnerWidth() {
          var _this$ownerNode$getCh2, _this$ownerNode$getCh3;
          var fillTransform = (_this$ownerNode$getCh2 = this.ownerNode.getChildByName('board')) == null || (_this$ownerNode$getCh2 = _this$ownerNode$getCh2.getChildByName('BoardFill')) == null ? void 0 : _this$ownerNode$getCh2.getComponent(UITransform);
          if (fillTransform) {
            return fillTransform.width;
          }
          var boardTransform = (_this$ownerNode$getCh3 = this.ownerNode.getChildByName('board')) == null ? void 0 : _this$ownerNode$getCh3.getComponent(UITransform);
          if (boardTransform) {
            return boardTransform.width - 40;
          }
          return this.getStepSize() * this.options.boardWidth;
        }

        /**
         * 读取棋盘有效内区高度。
         *
         * 优先读取 BoardFill，缺失时退回 board 节点尺寸并扣除边距，最后再使用格子步长兜底。
         * 这样棋盘装饰样式变化时，逻辑层仍以真实可落子区域为准。
         *
         * @returns 棋盘有效内区高度。
         */;
        _proto.getBoardInnerHeight = function getBoardInnerHeight() {
          var _this$ownerNode$getCh4, _this$ownerNode$getCh5;
          var fillTransform = (_this$ownerNode$getCh4 = this.ownerNode.getChildByName('board')) == null || (_this$ownerNode$getCh4 = _this$ownerNode$getCh4.getChildByName('BoardFill')) == null ? void 0 : _this$ownerNode$getCh4.getComponent(UITransform);
          if (fillTransform) {
            return fillTransform.height;
          }
          var boardTransform = (_this$ownerNode$getCh5 = this.ownerNode.getChildByName('board')) == null ? void 0 : _this$ownerNode$getCh5.getComponent(UITransform);
          if (boardTransform) {
            return boardTransform.height - 40;
          }
          return this.getStepSize() * this.options.boardHeight;
        }

        // 根据棋盘当前内区宽度计算左下角第一个格子的中心 x 坐标。
        ;

        _proto.getBoardGridOriginX = function getBoardGridOriginX() {
          return this.getBoardLocalPosition().x - this.getBoardInnerWidth() / 2 + this.getStepSize() / 2;
        }

        // 根据棋盘当前内区高度计算左下角第一个格子的中心 y 坐标。
        ;

        _proto.getBoardGridOriginY = function getBoardGridOriginY() {
          return this.getBoardLocalPosition().y - this.getBoardInnerHeight() / 2 + this.getStepSize() / 2;
        }

        // board 可以在 UI 重构时整体移动，棋子和触摸换算必须同步这个局部偏移。
        ;

        _proto.getBoardLocalPosition = function getBoardLocalPosition() {
          var _this$ownerNode$getCh6, _this$ownerNode$getCh7;
          return (_this$ownerNode$getCh6 = (_this$ownerNode$getCh7 = this.ownerNode.getChildByName('board')) == null ? void 0 : _this$ownerNode$getCh7.position) != null ? _this$ownerNode$getCh6 : Vec3.ZERO;
        };
        return BoardGeometry;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/BoardModel.ts", ['cc'], function (exports) {
  var cclegacy, Tween, UIOpacity;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
      Tween = module.Tween;
      UIOpacity = module.UIOpacity;
    }],
    execute: function () {
      cclegacy._RF.push({}, "71a2atGnNJDH5d35JNYpO+w", "BoardModel", undefined);
      // 棋盘数据的基础查询集中在这里，合并流程仍保留在 PlayController 中逐步拆分。
      var BoardModel = exports('BoardModel', /*#__PURE__*/function () {
        function BoardModel() {}
        var _proto = BoardModel.prototype;
        _proto.createEmptyBoard = function createEmptyBoard(rowCount, columnCount) {
          return Array.from({
            length: rowCount
          }, function () {
            return Array.from({
              length: columnCount
            }, function () {
              return null;
            });
          });
        }

        // 返回某列第一个空行，row 仍按“从下往上增长”的规则扫描。
        ;

        _proto.getDropRow = function getDropRow(board, rowCount, column) {
          for (var row = 0; row < rowCount; row++) {
            if (!board[row][column]) {
              return row;
            }
          }
          return -1;
        };
        _proto.isBoardFull = function isBoardFull(board, rowCount, columnCount) {
          for (var column = 0; column < columnCount; column++) {
            if (this.getDropRow(board, rowCount, column) >= 0) {
              return false;
            }
          }
          return true;
        }

        /**
         * 查找离目标列最近的可落子列。
         *
         * 优先返回玩家触摸的目标列；如果目标列已满，则按距离同时向左、向右扩散查找。
         * 这样玩家点到满列时，会尽量落到视觉上最接近的可用列。
         *
         * @param board 当前棋盘数组。
         * @param rowCount 棋盘行数。
         * @param columnCount 棋盘列数。
         * @param preferredColumn 玩家优先选择的列。
         * @returns 可落子列；所有列都不可用时返回 -1。
         */;
        _proto.getNearestAvailableColumn = function getNearestAvailableColumn(board, rowCount, columnCount, preferredColumn) {
          if (preferredColumn >= 0 && preferredColumn < columnCount && this.getDropRow(board, rowCount, preferredColumn) >= 0) {
            return preferredColumn;
          }
          for (var distance = 1; distance < columnCount; distance++) {
            var left = preferredColumn - distance;
            if (left >= 0 && this.getDropRow(board, rowCount, left) >= 0) {
              return left;
            }
            var right = preferredColumn + distance;
            if (right < columnCount && this.getDropRow(board, rowCount, right) >= 0) {
              return right;
            }
          }
          return -1;
        }

        /**
         * 在棋盘数组里查找某颗棋子当前所在的行列坐标。
         *
         * 棋子节点动画和棋盘数据可能在结算阶段短暂不同步，所以需要以 board 数组为准查找。
         *
         * @param board 当前棋盘数组。
         * @param rowCount 棋盘行数。
         * @param columnCount 棋盘列数。
         * @param target 要查找的棋子控制器。
         * @returns 棋子所在格子；未找到时返回 null。
         */;
        _proto.findPiece = function findPiece(board, rowCount, columnCount, target) {
          for (var row = 0; row < rowCount; row++) {
            for (var column = 0; column < columnCount; column++) {
              if (board[row][column] === target) {
                return {
                  row: row,
                  column: column
                };
              }
            }
          }
          return null;
        }

        // 清理棋盘内已经落地的棋子节点，返回首页和重新开始都复用这套收口逻辑。
        ;

        _proto.destroyBoardPieces = function destroyBoardPieces(board, rowCount, columnCount) {
          for (var row = 0; row < rowCount; row++) {
            for (var column = 0; column < columnCount; column++) {
              var piece = board[row][column];
              if (!piece) {
                continue;
              }
              if (piece.node.isValid) {
                // 销毁棋子前先停掉节点动画，避免场景切换后 tween 回调继续访问已销毁节点。
                Tween.stopAllByTarget(piece.node);
                var opacity = piece.node.getComponent(UIOpacity);
                if (opacity) {
                  Tween.stopAllByTarget(opacity);
                }
                piece.node.destroy();
              }
              board[row][column] = null;
            }
          }
        };
        return BoardModel;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/GameAudioManager.ts", ['cc'], function (exports) {
  var cclegacy, Node, AudioSource;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
      Node = module.Node;
      AudioSource = module.AudioSource;
    }],
    execute: function () {
      cclegacy._RF.push({}, "c9cb7zB9V5NJYZQGiD/iSns", "GameAudioManager", undefined);

      // 集中管理游戏音频节点，避免 PlayController 同时承担玩法和音频生命周期。
      var GameAudioManager = exports('GameAudioManager', /*#__PURE__*/function () {
        function GameAudioManager(ownerNode) {
          this.bgmAudioSource = null;
          this.sfxAudioSource = null;
          this.ownerNode = ownerNode;
        }

        // 运行时自动准备一对音频源，避免场景里必须手动摆放 BGM 和 SFX 节点。
        var _proto = GameAudioManager.prototype;
        _proto.setup = function setup() {
          this.bgmAudioSource = this.ensureAudioSourceNode('GameBgmAudioSource');
          this.sfxAudioSource = this.ensureAudioSourceNode('GameSfxAudioSource');
        }

        // 首页音乐使用独立入口，当前没有绑定资源时不会播放任何背景音乐。
        ;

        _proto.playStartPageBackgroundMusic = function playStartPageBackgroundMusic(clip) {
          this.playLoopBackgroundMusic(clip);
        }

        // 玩法音乐只在进入对局或重新开始后播放，避免首页误播游戏内 BGM。
        ;

        _proto.playGameplayBackgroundMusic = function playGameplayBackgroundMusic(clip) {
          this.playLoopBackgroundMusic(clip);
        }

        // 游戏结束时暂停背景音乐，保留短音效通道继续播放结算反馈。
        ;

        _proto.pauseBackgroundMusic = function pauseBackgroundMusic() {
          var _this$bgmAudioSource;
          if ((_this$bgmAudioSource = this.bgmAudioSource) != null && _this$bgmAudioSource.playing) {
            this.bgmAudioSource.pause();
          }
        }

        // 所有短音效都走 one-shot，避免切断当前正在播放的其他反馈音。
        ;

        _proto.playSoundEffect = function playSoundEffect(clip) {
          if (!clip || !this.sfxAudioSource) {
            return;
          }
          this.sfxAudioSource.playOneShot(clip);
        }

        // 音频节点不存在时自动创建；已存在则直接复用，避免重复加组件。
        ;

        _proto.ensureAudioSourceNode = function ensureAudioSourceNode(nodeName) {
          var _audioNode$getCompone;
          var audioNode = this.ownerNode.getChildByName(nodeName);
          if (!audioNode) {
            audioNode = new Node(nodeName);
            audioNode.setParent(this.ownerNode);
            audioNode.setPosition(0, 0, 0);
          }
          return (_audioNode$getCompone = audioNode.getComponent(AudioSource)) != null ? _audioNode$getCompone : audioNode.addComponent(AudioSource);
        }

        /**
         * 播放或停止循环背景音乐。
         *
         * clip 为空时会停止当前 BGM，避免返回首页后继续播放玩法音乐；
         * clip 变化时先停止旧音频再切换，clip 相同时不会重复重启正在播放的音乐。
         *
         * @param clip 要循环播放的背景音乐；为空时表示停止背景音乐。
         */;
        _proto.playLoopBackgroundMusic = function playLoopBackgroundMusic(clip) {
          if (!this.bgmAudioSource) {
            return;
          }
          if (!clip) {
            // 首页未配置专属 BGM 时，需要停止玩法 BGM，避免返回首页后继续播放游戏音乐。
            if (this.bgmAudioSource.playing) {
              this.bgmAudioSource.stop();
            }
            this.bgmAudioSource.clip = null;
            return;
          }
          if (this.bgmAudioSource.playing && this.bgmAudioSource.clip !== clip) {
            this.bgmAudioSource.stop();
          }
          this.bgmAudioSource.clip = clip;
          this.bgmAudioSource.loop = true;
          if (this.bgmAudioSource.playing) {
            return;
          }
          this.bgmAudioSource.play();
        };
        return GameAudioManager;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/GameFeedbackAdapter.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      cclegacy._RF.push({}, "3994039OklHc7+ssmiKUc6u", "GameFeedbackAdapter", undefined);
      /**
       * 客服反馈平台适配器。
       *
       * 玩法和设置弹窗只关心反馈入口是否成功打开，不直接依赖微信 API。
       * Web 预览没有统一客服目标时保持显式降级，避免打开错误或未配置的外部地址。
       */
      var GameFeedbackAdapter = exports('GameFeedbackAdapter', /*#__PURE__*/function () {
        function GameFeedbackAdapter() {}
        var _proto = GameFeedbackAdapter.prototype;
        _proto.open = function open(source) {
          var wxApi = globalThis.wx;
          if (typeof (wxApi == null ? void 0 : wxApi.openCustomerServiceConversation) !== 'function') {
            console.info('当前平台暂未接入客服反馈能力', source);
            return Promise.resolve('unsupported');
          }
          return new Promise(function (resolve) {
            try {
              wxApi.openCustomerServiceConversation == null || wxApi.openCustomerServiceConversation({
                sessionFrom: source,
                success: function success() {
                  return resolve('opened');
                },
                fail: function fail() {
                  return resolve('failed');
                }
              });
            } catch (_unused) {
              resolve('failed');
            }
          });
        };
        return GameFeedbackAdapter;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/GameOverOverlayController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _inheritsLoose, cclegacy, _decorator, UITransform, Node, UIOpacity, Graphics, Sprite, Color, Vec3, Label, LabelOutline, Tween, tween, Component;
  return {
    setters: [function (module) {
      _inheritsLoose = module.inheritsLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      UITransform = module.UITransform;
      Node = module.Node;
      UIOpacity = module.UIOpacity;
      Graphics = module.Graphics;
      Sprite = module.Sprite;
      Color = module.Color;
      Vec3 = module.Vec3;
      Label = module.Label;
      LabelOutline = module.LabelOutline;
      Tween = module.Tween;
      tween = module.tween;
      Component = module.Component;
    }],
    execute: function () {
      var _dec, _class;
      cclegacy._RF.push({}, "b6f85xUdCdJ8qlssKtR30WI", "GameOverOverlayController", undefined);
      var ccclass = _decorator.ccclass;

      // 结算弹窗使用短促的缩放与淡入动画，避免打断游戏结束反馈。
      var GAME_OVER_ANIM_DURATION = 0.18;
      // 面板尺寸与项目现有 Popup 素材比例接近，同时为纵向信息和 icon 操作区留足空间。
      var GAME_OVER_PANEL_WIDTH = 610;
      var GAME_OVER_PANEL_HEIGHT = 790;
      var GAME_OVER_PANEL_EDGE_INSET = 32;
      var GAME_OVER_PANEL_VERTICAL_INSET = 64;
      var GAME_OVER_ACTION_CENTER_X = 18;
      var GAME_OVER_ACTION_CENTER_Y = -232;
      var GAME_OVER_ACTION_SPACING = 116;
      var GAME_OVER_ICON_SIZE = 72;
      var GAME_OVER_HOME_ICON_SIZE = 80;
      var GAME_OVER_ICON_HIT_SIZE = 104;
      var GAME_OVER_ICON_LABEL_Y = -60;
      // Modal 图标原图是 208x214，显式按原图缩放可以避开 Sprite 自身 raw 尺寸覆盖 UITransform 的情况。
      var GAME_OVER_ICON_SOURCE_WIDTH = 208;
      var GAME_OVER_ICON_SOURCE_HEIGHT = 214;
      var GameOverOverlayController = exports('GameOverOverlayController', (_dec = ccclass('GameOverOverlayController'), _dec(_class = /*#__PURE__*/function (_Component) {
        _inheritsLoose(GameOverOverlayController, _Component);
        function GameOverOverlayController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          // 持有 play 根节点，用于同步画布尺寸并铺满遮罩。
          _this.hostNode = null;
          _this.maskNode = null;
          _this.panelNode = null;
          _this.scoreValueLabel = null;
          _this.highestValueLabel = null;
          _this.coinRewardLabel = null;
          _this.replayButtonNode = null;
          _this.homeButtonNode = null;
          _this.shareButtonNode = null;
          _this.overlayOpacity = null;
          _this.isVisible = false;
          _this.replayHandler = null;
          _this.shareHandler = null;
          _this.homeHandler = null;
          _this.popupSpriteFrame = null;
          _this.replayButtonSpriteFrame = null;
          _this.homeButtonSpriteFrame = null;
          _this.shareButtonSpriteFrame = null;
          _this.panelLayoutScale = 1;
          return _this;
        }
        var _proto = GameOverOverlayController.prototype;
        _proto.setup = function setup(options) {
          var _options$popupSpriteF, _options$replayButton, _options$homeButtonSp, _options$shareButtonS;
          this.hostNode = options.hostNode;
          this.replayHandler = options.replayHandler;
          this.shareHandler = options.shareHandler;
          this.homeHandler = options.homeHandler;
          this.popupSpriteFrame = (_options$popupSpriteF = options.popupSpriteFrame) != null ? _options$popupSpriteF : null;
          this.replayButtonSpriteFrame = (_options$replayButton = options.replayButtonSpriteFrame) != null ? _options$replayButton : null;
          this.homeButtonSpriteFrame = (_options$homeButtonSp = options.homeButtonSpriteFrame) != null ? _options$homeButtonSp : null;
          this.shareButtonSpriteFrame = (_options$shareButtonS = options.shareButtonSpriteFrame) != null ? _options$shareButtonS : null;
          this.ensureOverlayStructure();
          this.bindTouchEvents();
          this.syncLayout();
        }

        // 屏幕尺寸变化时同步遮罩，并在安全边距内等比缩放结算面板。
        ;

        _proto.syncLayout = function syncLayout() {
          var _this$hostNode, _this$node$getCompone, _ref, _hostTransform$width, _ref2, _hostTransform$height, _this$panelNode, _this$panelNode2;
          var hostTransform = (_this$hostNode = this.hostNode) == null ? void 0 : _this$hostNode.getComponent(UITransform);
          var overlayTransform = (_this$node$getCompone = this.node.getComponent(UITransform)) != null ? _this$node$getCompone : this.node.addComponent(UITransform);
          var width = (_ref = (_hostTransform$width = hostTransform == null ? void 0 : hostTransform.width) != null ? _hostTransform$width : overlayTransform.width) != null ? _ref : 750;
          var height = (_ref2 = (_hostTransform$height = hostTransform == null ? void 0 : hostTransform.height) != null ? _hostTransform$height : overlayTransform.height) != null ? _ref2 : 1334;
          overlayTransform.setContentSize(width, height);
          this.drawMask(width, height);
          this.panelLayoutScale = Math.min(1, Math.max(0.58, (width - GAME_OVER_PANEL_EDGE_INSET * 2) / GAME_OVER_PANEL_WIDTH), Math.max(0.58, (height - GAME_OVER_PANEL_VERTICAL_INSET * 2) / GAME_OVER_PANEL_HEIGHT));
          (_this$panelNode = this.panelNode) == null || _this$panelNode.setPosition(0, 0, 0);
          (_this$panelNode2 = this.panelNode) == null || _this$panelNode2.setScale(this.getPanelScale());
          this.drawPanelFallback();
        }

        // 外部只传入纯状态，弹窗自身负责显示、隐藏和文本刷新。
        ;

        _proto.renderState = function renderState(isGameOver, score, highestValue, coinReward) {
          this.refreshScore(score);
          this.refreshHighestValue(highestValue);
          this.refreshCoinReward(coinReward);
          this.bringNodeToTop(this.node);
          if (isGameOver) {
            this.show();
            return;
          }
          this.hide();
        };
        _proto.onDestroy = function onDestroy() {
          this.safeOff(this.maskNode, Node.EventType.TOUCH_START, this.swallowTouch);
          this.safeOff(this.maskNode, Node.EventType.TOUCH_MOVE, this.swallowTouch);
          this.safeOff(this.maskNode, Node.EventType.TOUCH_END, this.swallowTouch);
          this.safeOff(this.maskNode, Node.EventType.TOUCH_CANCEL, this.swallowTouch);
          this.safeOff(this.panelNode, Node.EventType.TOUCH_START, this.swallowTouch);
          this.safeOff(this.panelNode, Node.EventType.TOUCH_MOVE, this.swallowTouch);
          this.safeOff(this.panelNode, Node.EventType.TOUCH_END, this.swallowTouch);
          this.safeOff(this.panelNode, Node.EventType.TOUCH_CANCEL, this.swallowTouch);
          this.unbindButtonTouchEvents(this.replayButtonNode, this.onReplayButtonTap);
          this.unbindButtonTouchEvents(this.homeButtonNode, this.onHomeButtonTap);
          this.unbindButtonTouchEvents(this.shareButtonNode, this.onShareButtonTap);
          this.stopNodeTreeTweens(this.node);
        };
        _proto.ensureOverlayStructure = function ensureOverlayStructure() {
          var _this$node$getCompone2, _this$maskNode$getCom, _this$panelNode$getCo;
          this.node.active = false;
          this.overlayOpacity = (_this$node$getCompone2 = this.node.getComponent(UIOpacity)) != null ? _this$node$getCompone2 : this.node.addComponent(UIOpacity);
          this.overlayOpacity.opacity = 0;
          this.maskNode = this.getOrCreateNode(this.node, 'Mask');
          (_this$maskNode$getCom = this.maskNode.getComponent(Graphics)) != null ? _this$maskNode$getCom : this.maskNode.addComponent(Graphics);
          this.panelNode = this.getOrCreateNode(this.node, 'Panel');
          ((_this$panelNode$getCo = this.panelNode.getComponent(UITransform)) != null ? _this$panelNode$getCo : this.panelNode.addComponent(UITransform)).setContentSize(GAME_OVER_PANEL_WIDTH, GAME_OVER_PANEL_HEIGHT);
          this.configurePanelSprite(this.panelNode);
          this.ensureLabels(this.panelNode);
          this.replayButtonNode = this.ensureIconAction(this.panelNode, 'ReplayButton', '再来', this.replayButtonSpriteFrame, 'replay', GAME_OVER_ACTION_CENTER_X - GAME_OVER_ACTION_SPACING, GAME_OVER_ACTION_CENTER_Y, GAME_OVER_ICON_SIZE);
          this.homeButtonNode = this.ensureIconAction(this.panelNode, 'HomeButton', '首页', this.homeButtonSpriteFrame, 'home', GAME_OVER_ACTION_CENTER_X, GAME_OVER_ACTION_CENTER_Y + 10, GAME_OVER_HOME_ICON_SIZE);
          this.shareButtonNode = this.ensureIconAction(this.panelNode, 'ShareButton', '分享', this.shareButtonSpriteFrame, 'share', GAME_OVER_ACTION_CENTER_X + GAME_OVER_ACTION_SPACING, GAME_OVER_ACTION_CENTER_Y, GAME_OVER_ICON_SIZE);
        };
        _proto.configurePanelSprite = function configurePanelSprite(panel) {
          var _panel$getComponent, _panel$getComponent2;
          var sprite = (_panel$getComponent = panel.getComponent(Sprite)) != null ? _panel$getComponent : panel.addComponent(Sprite);
          sprite.spriteFrame = this.popupSpriteFrame;
          sprite.sizeMode = Sprite.SizeMode.CUSTOM;
          sprite.enabled = !!this.popupSpriteFrame;
          (_panel$getComponent2 = panel.getComponent(UITransform)) == null || _panel$getComponent2.setContentSize(GAME_OVER_PANEL_WIDTH, GAME_OVER_PANEL_HEIGHT);

          // Sprite 与 Graphics 都是可渲染组件，不能挂在同一个节点；无弹窗贴图时改用独立背景子节点兜底。
          var fallbackBackground = panel.getChildByName('FallbackBackground');
          if (fallbackBackground) {
            fallbackBackground.active = !this.popupSpriteFrame;
          }
        }

        /**
         * 信息层级按“最高合成 → 本次得分 → 行动按钮”纵向展开。
         * 只刷新数值节点，标题和提示保持为静态展示文案。
         */;
        _proto.ensureLabels = function ensureLabels(panel) {
          var _highestTile$getCompo;
          this.ensureLabel(panel, 'Title', '游戏结束', 48, new Color(255, 255, 255, 255), new Vec3(18, 330, 0), 430, 72, true, new Color(183, 39, 68, 230), 3);
          var highestTile = this.getOrCreateNode(panel, 'HighestTile');
          highestTile.setPosition(18, 196, 0);
          ((_highestTile$getCompo = highestTile.getComponent(UITransform)) != null ? _highestTile$getCompo : highestTile.addComponent(UITransform)).setContentSize(120, 104);
          this.drawHighestTile(highestTile);
          this.highestValueLabel = this.ensureLabel(highestTile, 'Value', '0', 39, new Color(255, 255, 255, 255), Vec3.ZERO, 108, 80, true, new Color(191, 105, 31, 210), 2);
          this.ensureLabel(panel, 'HighestTitle', '最高合成数字', 24, new Color(92, 147, 154, 255), new Vec3(18, 122, 0), 380, 42, false);
          this.ensureLabel(panel, 'ScoreTitle', '本次得分', 25, new Color(54, 110, 119, 255), new Vec3(18, 76, 0), 360, 42, true);
          this.scoreValueLabel = this.ensureLabel(panel, 'ScoreValue', '0', 58, new Color(40, 103, 117, 255), new Vec3(18, 18, 0), 430, 78, true);
          this.ensureLabel(panel, 'Tip', '再接再厉，继续冲击 1024', 22, new Color(166, 119, 76, 255), new Vec3(18, -48, 0), 430, 42, false);
          this.coinRewardLabel = this.ensureLabel(panel, 'CoinReward', '获得金币 +0', 24, new Color(226, 137, 34, 255), new Vec3(18, -105, 0), 360, 42, true, new Color(255, 250, 224, 180), 1);
        };
        _proto.ensureLabel = function ensureLabel(parent, name, text, fontSize, color, position, width, height, isBold, outlineColor, outlineWidth) {
          var _labelNode$getCompone, _labelNode$getCompone2, _labelNode$getCompone3;
          if (outlineColor === void 0) {
            outlineColor = new Color(255, 255, 255, 0);
          }
          if (outlineWidth === void 0) {
            outlineWidth = 0;
          }
          var labelNode = this.getOrCreateNode(parent, name);
          labelNode.setPosition(position);
          ((_labelNode$getCompone = labelNode.getComponent(UITransform)) != null ? _labelNode$getCompone : labelNode.addComponent(UITransform)).setContentSize(width, height);
          var label = (_labelNode$getCompone2 = labelNode.getComponent(Label)) != null ? _labelNode$getCompone2 : labelNode.addComponent(Label);
          label.string = text;
          label.fontSize = fontSize;
          label.lineHeight = Math.ceil(fontSize * 1.18);
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
          label.color = color;
          label.isBold = isBold;
          var outline = (_labelNode$getCompone3 = labelNode.getComponent(LabelOutline)) != null ? _labelNode$getCompone3 : labelNode.addComponent(LabelOutline);
          outline.color = outlineColor;
          outline.width = outlineWidth;
          return label;
        };
        _proto.ensureIconAction = function ensureIconAction(parent, name, text, spriteFrame, iconKind, x, y, iconSize) {
          var _button$getComponent, _iconNode$getComponen;
          var button = this.getOrCreateNode(parent, name);
          button.setPosition(x, y, 0)
          // icon 视觉较轻，但触摸热区保持足够大，避免小屏误点。
          ;

          ((_button$getComponent = button.getComponent(UITransform)) != null ? _button$getComponent : button.addComponent(UITransform)).setContentSize(GAME_OVER_ICON_HIT_SIZE, GAME_OVER_ICON_HIT_SIZE + 34);
          // 兼容旧版大按钮节点热更新复用：父节点只作为点击热区，不再渲染旧 Sprite/Graphics。
          var legacySprite = button.getComponent(Sprite);
          if (legacySprite) {
            legacySprite.enabled = false;
          }
          var legacyGraphics = button.getComponent(Graphics);
          if (legacyGraphics) {
            legacyGraphics.clear();
            legacyGraphics.enabled = false;
          }
          var iconNode = this.getOrCreateNode(button, 'Icon');
          iconNode.setPosition(0, 8, 0);
          var iconTransform = (_iconNode$getComponen = iconNode.getComponent(UITransform)) != null ? _iconNode$getComponen : iconNode.addComponent(UITransform);
          if (spriteFrame) {
            var _iconNode$getComponen2;
            var sprite = (_iconNode$getComponen2 = iconNode.getComponent(Sprite)) != null ? _iconNode$getComponen2 : iconNode.addComponent(Sprite);
            sprite.spriteFrame = spriteFrame;
            sprite.enabled = true;
            iconTransform.setContentSize(GAME_OVER_ICON_SOURCE_WIDTH, GAME_OVER_ICON_SOURCE_HEIGHT);
            sprite.sizeMode = Sprite.SizeMode.RAW;
            iconNode.setScale(this.getIconImageScale(iconSize));
          } else {
            var _fallbackVisual$getCo;
            var _sprite = iconNode.getComponent(Sprite);
            if (_sprite) {
              _sprite.enabled = false;
            }
            iconTransform.setContentSize(iconSize, iconSize);
            iconNode.setScale(Vec3.ONE);
            var _fallbackVisual = this.getOrCreateNode(iconNode, 'FallbackVisual');
            _fallbackVisual.active = true;
            _fallbackVisual.setPosition(Vec3.ZERO);
            ((_fallbackVisual$getCo = _fallbackVisual.getComponent(UITransform)) != null ? _fallbackVisual$getCo : _fallbackVisual.addComponent(UITransform)).setContentSize(iconSize, iconSize);
            this.drawIconFallback(_fallbackVisual, iconKind, iconSize);
          }
          var fallbackVisual = iconNode.getChildByName('FallbackVisual');
          if (fallbackVisual) {
            fallbackVisual.active = !spriteFrame;
          }
          this.ensureIconLabel(button, text);
          return button;
        };
        _proto.getIconImageScale = function getIconImageScale(iconSize) {
          var scale = iconSize / GAME_OVER_ICON_SOURCE_WIDTH;
          return new Vec3(scale, scale, 1);
        };
        _proto.ensureIconLabel = function ensureIconLabel(button, text) {
          var _labelNode$getCompone4, _labelNode$getCompone5, _labelNode$getCompone6;
          var labelNode = this.getOrCreateNode(button, 'Label');
          labelNode.setPosition(0, GAME_OVER_ICON_LABEL_Y, 0);
          (_labelNode$getCompone4 = labelNode.getComponent(UITransform)) == null || _labelNode$getCompone4.setContentSize(110, 36);
          var label = (_labelNode$getCompone5 = labelNode.getComponent(Label)) != null ? _labelNode$getCompone5 : labelNode.addComponent(Label);
          label.string = text;
          label.fontSize = 21;
          label.lineHeight = 28;
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
          label.color = new Color(93, 152, 162, 255);
          label.isBold = true;
          var outline = (_labelNode$getCompone6 = labelNode.getComponent(LabelOutline)) != null ? _labelNode$getCompone6 : labelNode.addComponent(LabelOutline);
          outline.color = new Color(255, 255, 255, 150);
          outline.width = 1;
        };
        _proto.drawIconFallback = function drawIconFallback(iconNode, iconKind, iconSize) {
          var _iconNode$getComponen3, _fallbackLabel$getCom, _fallbackLabel$getCom2;
          var graphics = (_iconNode$getComponen3 = iconNode.getComponent(Graphics)) != null ? _iconNode$getComponen3 : iconNode.addComponent(Graphics);
          graphics.clear();
          var halfSize = iconSize * 0.5;
          var innerSize = iconSize * 0.78;
          var innerHalf = innerSize * 0.5;
          graphics.fillColor = new Color(249, 253, 255, 255);
          graphics.roundRect(-halfSize, -halfSize, iconSize, iconSize, iconSize * 0.34);
          graphics.fill();
          graphics.fillColor = new Color(255, 59, 107, 255);
          graphics.roundRect(-innerHalf, -innerHalf, innerSize, innerSize, innerSize * 0.33);
          graphics.fill();

          // 缺少图片引用时用简化符号兜底；正式场景会绑定 Modal 下的三枚 icon。
          var iconText = iconKind === 'replay' ? '↻' : iconKind === 'home' ? '⌂' : '↗';
          var fallbackLabel = this.getOrCreateNode(iconNode, 'FallbackIcon');
          fallbackLabel.setPosition(0, iconKind === 'home' ? 0 : 1, 0);
          (_fallbackLabel$getCom = fallbackLabel.getComponent(UITransform)) == null || _fallbackLabel$getCom.setContentSize(innerSize, innerSize);
          var label = (_fallbackLabel$getCom2 = fallbackLabel.getComponent(Label)) != null ? _fallbackLabel$getCom2 : fallbackLabel.addComponent(Label);
          label.string = iconText;
          label.fontSize = iconKind === 'home' ? 55 : 58;
          label.lineHeight = 62;
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
          label.color = new Color(255, 255, 255, 255);
          label.isBold = true;
        };
        _proto.drawMask = function drawMask(width, height) {
          var _this$maskNode$getCom2, _this$maskNode$getCom3;
          if (!this.maskNode) {
            return;
          }
          var maskTransform = (_this$maskNode$getCom2 = this.maskNode.getComponent(UITransform)) != null ? _this$maskNode$getCom2 : this.maskNode.addComponent(UITransform);
          maskTransform.setContentSize(width, height);
          var graphics = (_this$maskNode$getCom3 = this.maskNode.getComponent(Graphics)) != null ? _this$maskNode$getCom3 : this.maskNode.addComponent(Graphics);
          graphics.clear();
          // 使用深蓝灰遮罩衔接冬季背景，避免纯黑色让结算态显得突兀。
          graphics.fillColor = new Color(19, 42, 62, 158);
          graphics.rect(-width * 0.5, -height * 0.5, width, height);
          graphics.fill();
        };
        _proto.drawPanelFallback = function drawPanelFallback() {
          var _background$getCompon, _background$getCompon2;
          if (!this.panelNode || this.popupSpriteFrame) {
            return;
          }
          var background = this.getOrCreateNode(this.panelNode, 'FallbackBackground');
          background.active = true;
          background.setPosition(Vec3.ZERO);
          background.setSiblingIndex(0);
          ((_background$getCompon = background.getComponent(UITransform)) != null ? _background$getCompon : background.addComponent(UITransform)).setContentSize(GAME_OVER_PANEL_WIDTH, GAME_OVER_PANEL_HEIGHT);
          var graphics = (_background$getCompon2 = background.getComponent(Graphics)) != null ? _background$getCompon2 : background.addComponent(Graphics);
          graphics.clear();
          graphics.fillColor = new Color(225, 109, 38, 255);
          graphics.roundRect(-GAME_OVER_PANEL_WIDTH * 0.5, -GAME_OVER_PANEL_HEIGHT * 0.5, GAME_OVER_PANEL_WIDTH, GAME_OVER_PANEL_HEIGHT, 44);
          graphics.fill();
          graphics.fillColor = new Color(255, 241, 216, 255);
          graphics.roundRect(-GAME_OVER_PANEL_WIDTH * 0.5 + 34, -GAME_OVER_PANEL_HEIGHT * 0.5 + 34, GAME_OVER_PANEL_WIDTH - 68, GAME_OVER_PANEL_HEIGHT - 92, 34);
          graphics.fill();
          graphics.fillColor = new Color(255, 62, 104, 255);
          graphics.roundRect(-226, 228, 470, 105, 28);
          graphics.fill();
        };
        _proto.drawHighestTile = function drawHighestTile(tile) {
          var _tile$getComponent;
          var graphics = (_tile$getComponent = tile.getComponent(Graphics)) != null ? _tile$getComponent : tile.addComponent(Graphics);
          graphics.clear();
          graphics.fillColor = new Color(202, 122, 40, 92);
          graphics.roundRect(-56, -56, 112, 104, 22);
          graphics.fill();
          graphics.fillColor = new Color(255, 174, 70, 255);
          graphics.roundRect(-60, -48, 120, 104, 22);
          graphics.fill();
          graphics.fillColor = new Color(255, 255, 255, 42);
          graphics.roundRect(-50, 18, 100, 25, 12);
          graphics.fill();
        };
        _proto.bindTouchEvents = function bindTouchEvents() {
          this.bindSwallowNode(this.maskNode);
          this.bindSwallowNode(this.panelNode);
          this.bindButtonTouchEvents(this.replayButtonNode, this.onReplayButtonTap);
          this.bindButtonTouchEvents(this.homeButtonNode, this.onHomeButtonTap);
          this.bindButtonTouchEvents(this.shareButtonNode, this.onShareButtonTap);
        };
        _proto.bindSwallowNode = function bindSwallowNode(node) {
          this.safeOff(node, Node.EventType.TOUCH_START, this.swallowTouch);
          this.safeOff(node, Node.EventType.TOUCH_MOVE, this.swallowTouch);
          this.safeOff(node, Node.EventType.TOUCH_END, this.swallowTouch);
          this.safeOff(node, Node.EventType.TOUCH_CANCEL, this.swallowTouch);
          this.safeOn(node, Node.EventType.TOUCH_START, this.swallowTouch);
          this.safeOn(node, Node.EventType.TOUCH_MOVE, this.swallowTouch);
          this.safeOn(node, Node.EventType.TOUCH_END, this.swallowTouch);
          this.safeOn(node, Node.EventType.TOUCH_CANCEL, this.swallowTouch);
        };
        _proto.bindButtonTouchEvents = function bindButtonTouchEvents(node, endHandler) {
          this.unbindButtonTouchEvents(node, endHandler);
          if (!this.canUseNode(node)) {
            return;
          }
          node.on(Node.EventType.TOUCH_START, this.swallowTouch, this);
          node.on(Node.EventType.TOUCH_MOVE, this.swallowTouch, this);
          node.on(Node.EventType.TOUCH_CANCEL, this.swallowTouch, this);
          node.on(Node.EventType.TOUCH_END, endHandler, this);
        };
        _proto.unbindButtonTouchEvents = function unbindButtonTouchEvents(node, endHandler) {
          if (!this.canUseNode(node)) {
            return;
          }
          node.off(Node.EventType.TOUCH_START, this.swallowTouch, this);
          node.off(Node.EventType.TOUCH_MOVE, this.swallowTouch, this);
          node.off(Node.EventType.TOUCH_CANCEL, this.swallowTouch, this);
          node.off(Node.EventType.TOUCH_END, endHandler, this);
        };
        _proto.canUseNode = function canUseNode(node) {
          return !!node && node.isValid;
        };
        _proto.safeOn = function safeOn(node, eventType, handler) {
          if (this.canUseNode(node)) {
            node.on(eventType, handler, this);
          }
        };
        _proto.safeOff = function safeOff(node, eventType, handler) {
          if (this.canUseNode(node)) {
            node.off(eventType, handler, this);
          }
        };
        _proto.getOrCreateNode = function getOrCreateNode(parent, name) {
          var node = parent.getChildByName(name);
          if (!node) {
            node = new Node(name);
            node.setParent(parent);
            node.addComponent(UITransform);
          }
          return node;
        };
        _proto.bringNodeToTop = function bringNodeToTop(node) {
          var _node$parent;
          var parent = (_node$parent = node == null ? void 0 : node.parent) != null ? _node$parent : null;
          if (this.canUseNode(node) && parent != null && parent.isValid) {
            node.setSiblingIndex(parent.children.length - 1);
          }
        };
        _proto.stopNodeTreeTweens = function stopNodeTreeTweens(node) {
          if (!this.canUseNode(node)) {
            return;
          }
          Tween.stopAllByTarget(node);
          var opacity = node.getComponent(UIOpacity);
          if (opacity) {
            Tween.stopAllByTarget(opacity);
          }
          for (var _i = 0, _arr = [].concat(node.children); _i < _arr.length; _i++) {
            var child = _arr[_i];
            this.stopNodeTreeTweens(child);
          }
        };
        _proto.swallowTouch = function swallowTouch(event) {
          event.propagationStopped = true;
        };
        _proto.onReplayButtonTap = function onReplayButtonTap(event) {
          var _this$replayHandler;
          event.propagationStopped = true;
          (_this$replayHandler = this.replayHandler) == null || _this$replayHandler.call(this);
        };
        _proto.onHomeButtonTap = function onHomeButtonTap(event) {
          var _this$homeHandler;
          event.propagationStopped = true;
          (_this$homeHandler = this.homeHandler) == null || _this$homeHandler.call(this);
        };
        _proto.onShareButtonTap = function onShareButtonTap(event) {
          var _this$shareHandler;
          event.propagationStopped = true;
          (_this$shareHandler = this.shareHandler) == null || _this$shareHandler.call(this);
        };
        _proto.refreshScore = function refreshScore(score) {
          if (this.scoreValueLabel) {
            this.scoreValueLabel.string = "" + Math.max(0, Math.floor(score));
          }
        };
        _proto.refreshHighestValue = function refreshHighestValue(highestValue) {
          if (this.highestValueLabel) {
            this.highestValueLabel.string = "" + Math.max(0, Math.floor(highestValue));
          }
        };
        _proto.refreshCoinReward = function refreshCoinReward(coinReward) {
          if (this.coinRewardLabel) {
            this.coinRewardLabel.string = "\u83B7\u5F97\u91D1\u5E01 +" + Math.max(0, Math.floor(coinReward));
          }
        };
        _proto.getPanelScale = function getPanelScale(factor) {
          if (factor === void 0) {
            factor = 1;
          }
          var scale = this.panelLayoutScale * factor;
          return new Vec3(scale, scale, 1);
        };
        _proto.show = function show() {
          var _this$panelNode4;
          if (!this.overlayOpacity) {
            return;
          }
          if (this.isVisible) {
            var _this$panelNode3;
            this.node.active = true;
            this.overlayOpacity.opacity = 255;
            (_this$panelNode3 = this.panelNode) == null || _this$panelNode3.setScale(this.getPanelScale());
            return;
          }
          this.isVisible = true;
          this.node.active = true;
          (_this$panelNode4 = this.panelNode) == null || _this$panelNode4.setScale(this.getPanelScale(0.92));
          this.overlayOpacity.opacity = 0;
          if (this.panelNode) {
            Tween.stopAllByTarget(this.panelNode);
          }
          Tween.stopAllByTarget(this.overlayOpacity);
          tween(this.overlayOpacity).to(GAME_OVER_ANIM_DURATION, {
            opacity: 255
          }, {
            easing: 'quadOut'
          }).start();
          if (this.panelNode) {
            tween(this.panelNode).to(GAME_OVER_ANIM_DURATION, {
              scale: this.getPanelScale()
            }, {
              easing: 'backOut'
            }).start();
          }
        };
        _proto.hide = function hide() {
          var _this2 = this;
          if (!this.overlayOpacity) {
            return;
          }
          if (!this.isVisible) {
            this.node.active = false;
            return;
          }
          this.isVisible = false;
          if (this.panelNode) {
            Tween.stopAllByTarget(this.panelNode);
          }
          Tween.stopAllByTarget(this.overlayOpacity);
          tween(this.overlayOpacity).to(0.12, {
            opacity: 0
          }, {
            easing: 'quadIn'
          }).call(function () {
            if (!_this2.isVisible) {
              var _this2$panelNode;
              _this2.node.active = false;
              (_this2$panelNode = _this2.panelNode) == null || _this2$panelNode.setScale(_this2.getPanelScale());
            }
          }).start();
        };
        return GameOverOverlayController;
      }(Component)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/GameShareAdapter.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      cclegacy._RF.push({}, "1d3f0fZyXZLPLonhOySEEEK", "GameShareAdapter", undefined);
      // 分享适配和玩法状态无关，单独放在这里方便后续替换微信或 Web 分享实现。
      var GameShareAdapter = exports('GameShareAdapter', /*#__PURE__*/function () {
        function GameShareAdapter() {}
        var _proto = GameShareAdapter.prototype;
        _proto.shareScore = function shareScore(score, source) {
          return this.shareMessage("\u6211\u5728 1024 \u6570\u5B57\u82B1\u56ED\u5408\u6210\u4E86 " + score + " \u5206\uFF0C\u6765\u6311\u6218\u4E00\u4E0B\u5427", source);
        }

        // 首页分享没有分数上下文，使用邀请挑战文案避免出现“0 分”。
        ;

        _proto.shareStartPage = function shareStartPage(source) {
          return this.shareMessage('来 1024 数字花园挑战连续合成吧', source);
        }

        // 资源奖励分享使用独立文案和来源标识，便于后续统计两种奖励入口。
        ;

        _proto.shareReward = function shareReward(kind) {
          var message = kind === 'coins' ? '分享 1024 数字花园，一起领取金币奖励吧' : '分享 1024 数字花园，一起补充闯关体力吧';
          return this.shareMessage(message, "reward_" + kind);
        };
        _proto.shareMessage = function shareMessage(message, source) {
          var wxApi = globalThis.wx;
          if (typeof (wxApi == null ? void 0 : wxApi.shareAppMessage) === 'function') {
            return this.shareWechatMessage({
              shareAppMessage: wxApi.shareAppMessage,
              onShow: wxApi.onShow,
              offShow: wxApi.offShow
            }, message, source);
          }
          var webNavigator = globalThis.navigator;
          if (typeof (webNavigator == null ? void 0 : webNavigator.share) === 'function') {
            return webNavigator.share({
              title: '1024 数字花园',
              text: message
            }).then(function () {
              return 'shared';
            })["catch"](function () {
              return 'cancelled';
            });
          }
          console.info('当前平台暂未接入分享能力', message);
          return Promise.resolve('unsupported');
        }

        /**
         * 微信端通过分享面板关闭后触发的 onShow 作为“完成分享流程”的回流信号。
         *
         * 微信不再可靠返回真实发送结果，因此这里不声称验证了具体收件人；
         * 奖励是否发放仍由调用方根据本次分享流程结果决定。
         */;
        _proto.shareWechatMessage = function shareWechatMessage(wxApi, message, source) {
          return new Promise(function (resolve) {
            var settled = false;
            var startedAt = Date.now();
            var timeoutId = null;
            var finish = function finish(result) {
              if (settled) {
                return;
              }
              settled = true;
              if (timeoutId !== null) {
                clearTimeout(timeoutId);
              }
              wxApi.offShow == null || wxApi.offShow(handleShow);
              resolve(result);
            };
            var handleShow = function handleShow() {
              // 忽略分享 API 调用同一帧内可能出现的生命周期噪声。
              if (Date.now() - startedAt < 250) {
                return;
              }
              finish('shared');
            };
            wxApi.onShow == null || wxApi.onShow(handleShow);
            timeoutId = setTimeout(function () {
              return finish('cancelled');
            }, 120000);
            try {
              wxApi.shareAppMessage({
                title: message,
                query: "from=" + source,
                // 旧基础库仍可能回调 success/fail；有回调时优先收口，没有时使用 onShow 回流。
                success: function success() {
                  return finish('shared');
                },
                fail: function fail() {
                  return finish('cancelled');
                }
              });
            } catch (_unused) {
              finish('cancelled');
            }
          });
        };
        return GameShareAdapter;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/HomeSceneController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './StartPageController.ts', './GameAudioManager.ts', './GameShareAdapter.ts', './PlayerEconomyStore.ts', './SkillShopPopupController.ts', './PlayController.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, _asyncToGenerator, _regeneratorRuntime, cclegacy, _decorator, AudioClip, SpriteFrame, Prefab, instantiate, director, Component, StartPageController, GameAudioManager, GameShareAdapter, PlayerEconomyStore, ECONOMY_CONFIG, SkillShopPopupController, OngoingGameSession;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
      _asyncToGenerator = module.asyncToGenerator;
      _regeneratorRuntime = module.regeneratorRuntime;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      AudioClip = module.AudioClip;
      SpriteFrame = module.SpriteFrame;
      Prefab = module.Prefab;
      instantiate = module.instantiate;
      director = module.director;
      Component = module.Component;
    }, function (module) {
      StartPageController = module.StartPageController;
    }, function (module) {
      GameAudioManager = module.GameAudioManager;
    }, function (module) {
      GameShareAdapter = module.GameShareAdapter;
    }, function (module) {
      PlayerEconomyStore = module.PlayerEconomyStore;
      ECONOMY_CONFIG = module.ECONOMY_CONFIG;
    }, function (module) {
      SkillShopPopupController = module.SkillShopPopupController;
    }, function (module) {
      OngoingGameSession = module.OngoingGameSession;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10;
      cclegacy._RF.push({}, "0d7b4w3TvdLZaiNHzWsTvXb", "HomeSceneController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var HomeSceneController = exports('HomeSceneController', (_dec = ccclass('HomeSceneController'), _dec2 = property({
        tooltip: 'Loading scene name'
      }), _dec3 = property({
        tooltip: 'Game scene name'
      }), _dec4 = property({
        type: AudioClip,
        tooltip: 'Home page background music'
      }), _dec5 = property({
        type: AudioClip,
        tooltip: 'Start page background music'
      }), _dec6 = property({
        type: SpriteFrame,
        tooltip: 'Start page background sprite frame'
      }), _dec7 = property({
        type: SpriteFrame,
        tooltip: 'Start page rank button sprite frame'
      }), _dec8 = property({
        type: SpriteFrame,
        tooltip: 'Start page settings button sprite frame'
      }), _dec9 = property({
        type: SpriteFrame,
        tooltip: 'Start page share button sprite frame'
      }), _dec10 = property({
        type: Prefab,
        tooltip: 'Home energy bar prefab'
      }), _dec11 = property({
        type: Prefab,
        tooltip: 'Pre-game skill shop popup prefab'
      }), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(HomeSceneController, _Component);
        function HomeSceneController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          // 首页点击开始后加载的轻量加载场景，默认对应 assets/scence/loading.scene。
          _initializerDefineProperty(_this, "loadingSceneName", _descriptor, _assertThisInitialized(_this));
          // loading 预加载完成后进入的玩法场景名，loadingSceneName 为空时也会作为安全兜底。
          _initializerDefineProperty(_this, "gameSceneName", _descriptor2, _assertThisInitialized(_this));
          // Home 页专用背景音乐，进入首页场景后循环播放。
          _initializerDefineProperty(_this, "homeBgmClip", _descriptor3, _assertThisInitialized(_this));
          // 旧版首页背景音乐字段，保留用于兼容已经绑定过 startPageBgmClip 的场景。
          _initializerDefineProperty(_this, "startPageBgmClip", _descriptor4, _assertThisInitialized(_this));
          // 首页背景图，建议在 home.scene 的层级中维护 Sprite，脚本只做兜底传入。
          _initializerDefineProperty(_this, "startPageBackgroundSpriteFrame", _descriptor5, _assertThisInitialized(_this));
          // 首页底部排行榜按钮贴图，优先由层级管理器中的按钮节点维护。
          _initializerDefineProperty(_this, "startPageRankButtonSpriteFrame", _descriptor6, _assertThisInitialized(_this));
          // 首页底部设置按钮贴图，优先由层级管理器中的按钮节点维护。
          _initializerDefineProperty(_this, "startPageSettingsButtonSpriteFrame", _descriptor7, _assertThisInitialized(_this));
          // 首页底部分享按钮贴图，优先由层级管理器中的按钮节点维护。
          _initializerDefineProperty(_this, "startPageShareButtonSpriteFrame", _descriptor8, _assertThisInitialized(_this));
          // 首页只展示体力条；金币条由 game.scene 的单局 HUD 负责。
          _initializerDefineProperty(_this, "energyBarPrefab", _descriptor9, _assertThisInitialized(_this));
          // 开始游戏前展示的技能购买弹窗，布局和素材封装在独立 Prefab 中。
          _initializerDefineProperty(_this, "skillShopPopupPrefab", _descriptor10, _assertThisInitialized(_this));
          _this.startPageController = null;
          _this.skillShopNode = null;
          _this.skillShopController = null;
          _this.audioManager = null;
          _this.shareAdapter = new GameShareAdapter();
          _this.economy = PlayerEconomyStore.getInstance();
          _this.isLoadingGameScene = false;
          _this.dailyLoginReward = 0;
          return _this;
        }
        var _proto = HomeSceneController.prototype;
        _proto.onLoad = function onLoad() {
          var _this$getComponent,
            _this2 = this;
          this.audioManager = new GameAudioManager(this.node);
          this.audioManager.setup();
          var dailyResult = this.economy.claimDailyLogin();
          this.dailyLoginReward = dailyResult.claimed ? dailyResult.amount : 0;
          var resources = this.economy.getSnapshot();
          this.startPageController = (_this$getComponent = this.getComponent(StartPageController)) != null ? _this$getComponent : this.addComponent(StartPageController);
          this.startPageController.setup({
            onStartTap: function onStartTap() {
              return _this2.openSkillShop();
            },
            onShareTap: function onShareTap() {
              return _this2.shareGameFromStartPage();
            },
            backgroundSpriteFrame: this.startPageBackgroundSpriteFrame,
            rankButtonSpriteFrame: this.startPageRankButtonSpriteFrame,
            settingsButtonSpriteFrame: this.startPageSettingsButtonSpriteFrame,
            shareButtonSpriteFrame: this.startPageShareButtonSpriteFrame,
            energyBarPrefab: this.energyBarPrefab,
            energy: resources.energy,
            maxEnergy: resources.maxEnergy,
            onEnergyMoreTap: function onEnergyMoreTap() {
              return void _this2.shareForEnergyReward();
            }
          });
        };
        _proto.start = function start() {
          var _this$startPageContro, _this$skillShopContro, _this$audioManager;
          // 首帧后再同步一次布局，兼容微信安全区和 Creator 预览尺寸变化。
          (_this$startPageContro = this.startPageController) == null || _this$startPageContro.syncLayout();
          (_this$skillShopContro = this.skillShopController) == null || _this$skillShopContro.syncLayout();
          (_this$audioManager = this.audioManager) == null || _this$audioManager.playStartPageBackgroundMusic(this.getHomeBgmClip());
          if (this.dailyLoginReward > 0) {
            var _this$startPageContro2;
            (_this$startPageContro2 = this.startPageController) == null || _this$startPageContro2.showMessage("\u6BCF\u65E5\u767B\u5F55\u5956\u52B1\uFF1A\u91D1\u5E01 +" + this.dailyLoginReward);
          }
        };
        _proto.onDestroy = function onDestroy() {
          this.skillShopController = null;
          this.skillShopNode = null;
        }

        /**
         * 有未结束对局时直接续局；只有新开一局才展示技能购买弹窗。
         */;
        _proto.openSkillShop = function openSkillShop() {
          var _this$skillShopNode,
            _this$skillShopContro2,
            _this3 = this;
          if (this.isLoadingGameScene) {
            return;
          }
          if (OngoingGameSession.hasActiveGame()) {
            this.enterOngoingGameScene();
            return;
          }
          if (!this.canStartNewGame()) {
            var _this$startPageContro3;
            this.closeSkillShop();
            (_this$startPageContro3 = this.startPageController) == null || _this$startPageContro3.showMessage('体力不足，请先点击体力条补充');
            this.refreshPlayerResources();
            return;
          }
          if (!((_this$skillShopNode = this.skillShopNode) != null && _this$skillShopNode.isValid) || !((_this$skillShopContro2 = this.skillShopController) != null && _this$skillShopContro2.isValid)) {
            var _this$skillShopNode$g;
            if (!this.skillShopPopupPrefab) {
              var _this$startPageContro4;
              (_this$startPageContro4 = this.startPageController) == null || _this$startPageContro4.showMessage('技能购买弹窗资源未配置');
              return;
            }
            this.skillShopNode = instantiate(this.skillShopPopupPrefab);
            this.skillShopNode.setParent(this.node);
            this.skillShopNode.setPosition(0, 0, 0);
            this.skillShopController = (_this$skillShopNode$g = this.skillShopNode.getComponent(SkillShopPopupController)) != null ? _this$skillShopNode$g : this.skillShopNode.addComponent(SkillShopPopupController);
            this.skillShopController.setup({
              hostNode: this.node,
              onPurchase: function onPurchase(skill) {
                return _this3.purchaseSkill(skill);
              },
              onStart: function onStart() {
                return _this3.enterGameScene();
              },
              onClose: function onClose() {
                return _this3.closeSkillShop();
              }
            });
          }
          this.skillShopController.renderState(this.economy.getSnapshot());
          this.skillShopController.showMessage('可在开始前补充技能');
          this.skillShopController.syncLayout();
          this.skillShopController.show();
        }

        // 购买结果由经济仓库生成，弹窗只渲染最新余额并展示反馈。
        ;

        _proto.purchaseSkill = function purchaseSkill(skill) {
          var _this$skillShopContro3, _this$skillShopContro4;
          var result = this.economy.purchaseSkill(skill);
          var skillName = skill === 'bomb' ? '炸弹' : skill === 'hammer' ? '锤子' : '交换';
          (_this$skillShopContro3 = this.skillShopController) == null || _this$skillShopContro3.renderState(this.economy.getSnapshot());
          (_this$skillShopContro4 = this.skillShopController) == null || _this$skillShopContro4.showMessage(result.purchased ? "\u8D2D\u4E70\u6210\u529F\uFF1A" + skillName + " +1" : result.reason === 'max-reached' ? skillName + "\u6700\u591A\u6301\u6709 " + ECONOMY_CONFIG.maxSkillCount + " \u4E2A" : "\u91D1\u5E01\u4E0D\u8DB3\uFF0C\u8D2D\u4E70" + skillName + "\u9700\u8981 " + result.price + " \u91D1\u5E01", !result.purchased);
        };
        _proto.closeSkillShop = function closeSkillShop() {
          var _this$skillShopContro5;
          (_this$skillShopContro5 = this.skillShopController) == null || _this$skillShopContro5.hide();
        }

        // 开始游戏前由经济层统一扣除体力，扣除失败时停留首页并给出补充入口提示。
        ;

        _proto.enterGameScene = function enterGameScene() {
          var _this$skillShopContro6;
          if (this.isLoadingGameScene) {
            return;
          }
          if (!this.economy.tryConsumeEnergy()) {
            var _this$startPageContro5;
            this.closeSkillShop();
            (_this$startPageContro5 = this.startPageController) == null || _this$startPageContro5.showMessage('体力不足，请先点击体力条补充');
            this.refreshPlayerResources();
            return;
          }
          this.isLoadingGameScene = true;
          OngoingGameSession.beginNewGame();
          this.refreshPlayerResources();
          (_this$skillShopContro6 = this.skillShopController) == null || _this$skillShopContro6.hide();
          var sceneName = this.getStartTargetSceneName();
          // 点击事件分发结束前直接切场景，部分平台会在销毁按钮节点时触发事件系统空引用。
          // 这里只延后一帧进入目标场景，每次从首页开始都先展示一条随机加载提示。
          this.scheduleOnce(function () {
            return director.loadScene(sceneName);
          }, 0);
        }

        // 续局不重复扣体力，也不经过开始前的技能购买弹窗和 loading 提示页。
        ;

        _proto.enterOngoingGameScene = function enterOngoingGameScene() {
          var _this$skillShopContro7;
          if (this.isLoadingGameScene) {
            return;
          }
          this.isLoadingGameScene = true;
          (_this$skillShopContro7 = this.skillShopController) == null || _this$skillShopContro7.hide();
          var sceneName = this.gameSceneName || this.getStartTargetSceneName();
          this.scheduleOnce(function () {
            return director.loadScene(sceneName);
          }, 0);
        }

        // 每次从首页进入游戏都走 loading；若场景名未配置，再直接进入玩法场景兜底。
        ;

        _proto.getStartTargetSceneName = function getStartTargetSceneName() {
          return this.loadingSceneName || this.gameSceneName;
        }

        // 新开一局前先在首页拦截体力不足，避免玩家先看到技能购买弹窗再被拦住。
        ;

        _proto.canStartNewGame = function canStartNewGame() {
          return this.economy.getSnapshot().energy >= ECONOMY_CONFIG.gameEnergyCost;
        }

        // Home 页优先使用新字段，旧字段只作为历史场景的兜底资源位。
        ;

        _proto.getHomeBgmClip = function getHomeBgmClip() {
          var _this$homeBgmClip;
          return (_this$homeBgmClip = this.homeBgmClip) != null ? _this$homeBgmClip : this.startPageBgmClip;
        }

        /**
         * 点击顶部资源 Prefab 后完成分享并领取对应资源。
         * 分享不限制每日次数；经济层只负责体力上限校验和成功后的持久化。
         */;
        _proto.shareForEnergyReward = /*#__PURE__*/
        function () {
          var _shareForEnergyReward = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee() {
            var _this$startPageContro10;
            var _this$startPageContro6, result, _this$startPageContro7, _this$startPageContro8, claim, _this$startPageContro9;
            return _regeneratorRuntime().wrap(function _callee$(_context) {
              while (1) switch (_context.prev = _context.next) {
                case 0:
                  if (this.economy.canClaimShareReward('energy')) {
                    _context.next = 3;
                    break;
                  }
                  (_this$startPageContro6 = this.startPageController) == null || _this$startPageContro6.showMessage('体力已满，无需补充');
                  return _context.abrupt("return");
                case 3:
                  _context.next = 5;
                  return this.shareAdapter.shareReward('energy');
                case 5:
                  result = _context.sent;
                  if (this.node.isValid) {
                    _context.next = 8;
                    break;
                  }
                  return _context.abrupt("return");
                case 8:
                  if (!(result === 'cancelled')) {
                    _context.next = 11;
                    break;
                  }
                  (_this$startPageContro7 = this.startPageController) == null || _this$startPageContro7.showMessage('分享未完成，未发放奖励');
                  return _context.abrupt("return");
                case 11:
                  if (!(result === 'unsupported')) {
                    _context.next = 14;
                    break;
                  }
                  (_this$startPageContro8 = this.startPageController) == null || _this$startPageContro8.showMessage('当前平台暂不支持分享奖励');
                  return _context.abrupt("return");
                case 14:
                  claim = this.economy.claimShareReward('energy');
                  if (claim.claimed) {
                    _context.next = 18;
                    break;
                  }
                  (_this$startPageContro9 = this.startPageController) == null || _this$startPageContro9.showMessage('体力已满，无需补充');
                  return _context.abrupt("return");
                case 18:
                  this.refreshPlayerResources();
                  (_this$startPageContro10 = this.startPageController) == null || _this$startPageContro10.showMessage("\u5206\u4EAB\u5956\u52B1\uFF1A\u4F53\u529B +" + claim.amount);
                case 20:
                case "end":
                  return _context.stop();
              }
            }, _callee, this);
          }));
          function shareForEnergyReward() {
            return _shareForEnergyReward.apply(this, arguments);
          }
          return shareForEnergyReward;
        }() // 每次资源发生变化后，从仓库快照重新渲染，首页 UI 不缓存也不修改玩家数据。
        ;

        _proto.refreshPlayerResources = function refreshPlayerResources() {
          var _this$startPageContro11;
          var snapshot = this.economy.getSnapshot();
          (_this$startPageContro11 = this.startPageController) == null || _this$startPageContro11.renderPlayerResources(snapshot.energy, snapshot.maxEnergy);
        }

        // 首页分享还没有本局分数，使用邀请挑战文案更符合入口语境。
        ;

        _proto.shareGameFromStartPage = function shareGameFromStartPage() {
          void this.shareAdapter.shareStartPage('start_share');
        };
        return HomeSceneController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "loadingSceneName", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 'loading';
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "gameSceneName", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 'game';
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "homeBgmClip", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "startPageBgmClip", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "startPageBackgroundSpriteFrame", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "startPageRankButtonSpriteFrame", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "startPageSettingsButtonSpriteFrame", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "startPageShareButtonSpriteFrame", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "energyBarPrefab", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "skillShopPopupPrefab", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/LoadingSceneController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, _createForOfIteratorHelperLoose, cclegacy, _decorator, Color, SpriteFrame, Node, Tween, director, Label, UITransform, Graphics, Vec3, UIOpacity, Sprite, tween, Component;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Color = module.Color;
      SpriteFrame = module.SpriteFrame;
      Node = module.Node;
      Tween = module.Tween;
      director = module.director;
      Label = module.Label;
      UITransform = module.UITransform;
      Graphics = module.Graphics;
      Vec3 = module.Vec3;
      UIOpacity = module.UIOpacity;
      Sprite = module.Sprite;
      tween = module.tween;
      Component = module.Component;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8;
      cclegacy._RF.push({}, "08666rxj3JAq4IH6SO/Pbni", "LoadingSceneController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var DEFAULT_PROGRESS_WIDTH = 420;
      var DEFAULT_PROGRESS_HEIGHT = 22;
      var DEFAULT_PROGRESS_Y = -492;
      var DEFAULT_LABEL_Y = -548;
      var TIP_CARD_WIDTH = 620;
      var TIP_CARD_HEIGHT = 500;
      // 玩法提示沿用首页的五条核心信息，技能提示补充实际施放手势，避免两个页面出现冲突口径。
      var LOADING_TIPS = [{
        category: '玩法提示',
        title: '相同数字，碰一碰就升级',
        description: '相同数字相邻后会自动合成，越大的数字得分越高。',
        visual: 'merge'
      }, {
        category: '玩法提示',
        title: '按住目标列，快速落子',
        description: '在棋盘内按住想放的列，棋子会加速下落。',
        visual: 'drop'
      }, {
        category: '玩法提示',
        title: '先看底部，再选落点',
        description: '给相同数字预留相邻位置，下一步更容易连锁。',
        visual: 'plan'
      }, {
        category: '玩法提示',
        title: '连锁合成，分数涨得更快',
        description: '一次落子触发多轮合并，连锁越长奖励越多。',
        visual: 'chain'
      }, {
        category: '玩法提示',
        title: '给棋盘留一点呼吸空间',
        description: '尽量留出一列空位，避免所有列同时被塞满。',
        visual: 'space'
      }, {
        category: '技能教程',
        title: '炸弹：清理一大片',
        description: '点击炸弹技能，再点一个中心棋子，炸掉周围 3×3 范围。',
        visual: 'bomb'
      }, {
        category: '技能教程',
        title: '锤子：精准清障',
        description: '点击锤子技能，再点一个棋子，单独把它敲碎。',
        visual: 'hammer'
      }, {
        category: '技能教程',
        title: '交换：拖出新组合',
        description: '点击交换技能，拖动一个棋子到相邻格；形成合并才会保留。',
        visual: 'swap'
      }];
      var TILE_COLORS = [new Color(255, 205, 119, 255), new Color(116, 210, 177, 255), new Color(102, 179, 224, 255), new Color(244, 144, 150, 255)];

      // 模块级索引跨 loading.scene 的多次实例保留，用来减少连续两次抽到同一条提示的概率。
      var previousTipIndex = -1;
      var LoadingSceneController = exports('LoadingSceneController', (_dec = ccclass('LoadingSceneController'), _dec2 = property({
        tooltip: 'Target scene name'
      }), _dec3 = property({
        tooltip: 'Minimum loading page duration in seconds'
      }), _dec4 = property({
        type: SpriteFrame,
        tooltip: 'Bomb skill tutorial sprite frame'
      }), _dec5 = property({
        type: SpriteFrame,
        tooltip: 'Hammer skill tutorial sprite frame'
      }), _dec6 = property({
        type: SpriteFrame,
        tooltip: 'Swap skill tutorial sprite frame'
      }), _dec7 = property({
        type: Node,
        tooltip: 'Background node'
      }), _dec8 = property({
        type: Node,
        tooltip: 'Progress fill node'
      }), _dec9 = property({
        type: Node,
        tooltip: 'Percent label node'
      }), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(LoadingSceneController, _Component);
        function LoadingSceneController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          // 加载完成后进入的目标场景，默认对应 assets/scence/game.scene。
          _initializerDefineProperty(_this, "targetSceneName", _descriptor, _assertThisInitialized(_this));
          // 加载页最短停留时间，给玩家留出看清随机提示的时间。
          _initializerDefineProperty(_this, "minimumDisplaySeconds", _descriptor2, _assertThisInitialized(_this));
          // 三个技能教程复用游戏内技能按钮贴图，保证玩家进入对局后能直接认出对应按钮。
          _initializerDefineProperty(_this, "bombSpriteFrame", _descriptor3, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "hammerSpriteFrame", _descriptor4, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "swapSpriteFrame", _descriptor5, _assertThisInitialized(_this));
          // 背景节点优先由层级管理器维护，脚本只负责绘制轻量纯色装饰。
          _initializerDefineProperty(_this, "backgroundNodeRef", _descriptor6, _assertThisInitialized(_this));
          // 进度条填充节点可在层级管理器里指定，缺失时用代码兜底绘制。
          _initializerDefineProperty(_this, "progressFillNodeRef", _descriptor7, _assertThisInitialized(_this));
          // 百分比文本节点可在层级管理器里指定，缺失时用代码兜底创建。
          _initializerDefineProperty(_this, "percentLabelNodeRef", _descriptor8, _assertThisInitialized(_this));
          _this.backgroundNode = null;
          _this.progressTrackNode = null;
          _this.progressFillNode = null;
          _this.percentLabel = null;
          _this.tipCardNode = null;
          _this.tipIconNode = null;
          _this.activeTip = LOADING_TIPS[0];
          _this.hasRequestedLoadScene = false;
          // 记录 loading 开始时间，用来保证加载页至少展示 minimumDisplaySeconds。
          _this.loadingStartedAtMs = 0;
          return _this;
        }
        var _proto = LoadingSceneController.prototype;
        _proto.onLoad = function onLoad() {
          this.selectRandomPresentation();
          this.ensureLoadingUi();
          this.renderProgress(0);
        };
        _proto.start = function start() {
          var _this2 = this;
          this.fitBackgroundToCanvas();
          this.scheduleOnce(function () {
            return _this2.fitBackgroundToCanvas();
          }, 0);
          this.playEntranceAnimation();
          this.startLoadingTargetScene();
        };
        _proto.onDestroy = function onDestroy() {
          if (this.tipCardNode) {
            Tween.stopAllByTarget(this.tipCardNode);
          }
          if (this.tipIconNode) {
            Tween.stopAllByTarget(this.tipIconNode);
          }
        }

        /**
         * 加载目标场景并同步进度表现。
         *
         * Cocos 的 preloadScene 会分阶段回调 completedCount / totalCount；
         * 加载完成后再结合最短展示时间 loadScene，避免直接切玩法场景时出现黑屏等待或闪屏感。
         */;
        _proto.startLoadingTargetScene = function startLoadingTargetScene() {
          var _this3 = this;
          if (this.hasRequestedLoadScene) {
            return;
          }
          this.hasRequestedLoadScene = true;
          this.loadingStartedAtMs = Date.now();
          director.preloadScene(this.targetSceneName, function (completedCount, totalCount) {
            _this3.renderProgress(totalCount > 0 ? completedCount / totalCount : 0);
          }, function () {
            _this3.renderProgress(1);
            var elapsedSeconds = (Date.now() - _this3.loadingStartedAtMs) / 1000;
            var remainingSeconds = Math.max(0, _this3.minimumDisplaySeconds - elapsedSeconds);
            // 即使资源已加载完成，也等到最短停留时间后再切场景，让过渡节奏更稳定。
            _this3.scheduleOnce(function () {
              return director.loadScene(_this3.targetSceneName);
            }, remainingSeconds);
          });
        }

        // 加载页 UI 优先使用层级节点，缺失时补最小结构，便于 Creator 里继续调样式。
        ;

        _proto.ensureLoadingUi = function ensureLoadingUi() {
          var _ref, _this$backgroundNodeR, _this$progressFillNod, _ref2, _this$percentLabelNod, _this$percentLabelNod2, _this$findChildDeep;
          // loading 不再展示旧 1024 Logo；场景节点保留关闭状态，避免破坏已有层级引用。
          var legacyLogo = this.findChildDeep(this.node, 'Logo');
          if (legacyLogo) {
            legacyLogo.active = false;
          }
          this.backgroundNode = (_ref = (_this$backgroundNodeR = this.backgroundNodeRef) != null ? _this$backgroundNodeR : this.node.getChildByName('Background')) != null ? _ref : this.createBackgroundNode();
          this.progressFillNode = (_this$progressFillNod = this.progressFillNodeRef) != null ? _this$progressFillNod : this.findChildDeep(this.node, 'ProgressFill');
          this.percentLabel = (_ref2 = (_this$percentLabelNod = (_this$percentLabelNod2 = this.percentLabelNodeRef) == null ? void 0 : _this$percentLabelNod2.getComponent(Label)) != null ? _this$percentLabelNod : (_this$findChildDeep = this.findChildDeep(this.node, 'PercentLabel')) == null ? void 0 : _this$findChildDeep.getComponent(Label)) != null ? _ref2 : null;
          if (!this.progressFillNode) {
            this.createFallbackProgressBar();
          }
          if (!this.percentLabel) {
            this.percentLabel = this.createFallbackPercentLabel();
          }
          this.createLoadingHeader();
          this.createRandomTipCard();
          this.fitBackgroundToCanvas();
        }

        /**
         * 为本次加载选择提示。
         *
         * 随机结果会避开上一次使用的索引；当提示只有一项时仍安全回退到该项。
         * 选择动作发生在 UI 创建之前，保证玩家看到的首帧就是最终内容，不产生文字或图片跳变。
         */;
        _proto.selectRandomPresentation = function selectRandomPresentation() {
          var tipIndex = this.pickRandomIndex(LOADING_TIPS.length, previousTipIndex);
          previousTipIndex = tipIndex;
          this.activeTip = LOADING_TIPS[tipIndex];
        }

        // 随机索引会尽量避开上一项，让玩家连续返回首页再开始时更容易看到新内容。
        ;

        _proto.pickRandomIndex = function pickRandomIndex(length, excludedIndex) {
          if (length <= 1) {
            return 0;
          }
          var randomOffset = Math.floor(Math.random() * (length - 1)) + 1;
          return excludedIndex >= 0 ? (excludedIndex + randomOffset) % length : Math.floor(Math.random() * length);
        };
        _proto.createBackgroundNode = function createBackgroundNode() {
          var background = new Node('Background');
          background.setParent(this.node);
          background.addComponent(UITransform);
          background.addComponent(Graphics);
          background.setSiblingIndex(0);
          return background;
        }

        /**
         * 根据 Canvas 尺寸绘制加载页纯色背景。
         *
         * 背景只使用低对比纯色、圆形色块和点阵，不再依赖首页背景图或 Logo 资源；
         * 既能降低加载页自身资源量，也让随机提示卡成为页面唯一视觉重点。
         */;
        _proto.fitBackgroundToCanvas = function fitBackgroundToCanvas() {
          var _this$backgroundNode$, _this$backgroundNode$2;
          if (!this.backgroundNode) {
            return;
          }
          var canvasTransform = this.node.getComponent(UITransform);
          var backgroundTransform = (_this$backgroundNode$ = this.backgroundNode.getComponent(UITransform)) != null ? _this$backgroundNode$ : this.backgroundNode.addComponent(UITransform);
          var backgroundGraphics = (_this$backgroundNode$2 = this.backgroundNode.getComponent(Graphics)) != null ? _this$backgroundNode$2 : this.backgroundNode.addComponent(Graphics);
          if (!canvasTransform) {
            return;
          }
          var width = canvasTransform.width;
          var height = canvasTransform.height;
          backgroundTransform.setContentSize(width, height);
          backgroundGraphics.clear();
          backgroundGraphics.fillColor = new Color(236, 248, 244, 255);
          backgroundGraphics.rect(-width / 2, -height / 2, width, height);
          backgroundGraphics.fill();

          // 大色块只压在边角，中心区域保持干净，避免影响教程文字可读性。
          backgroundGraphics.fillColor = new Color(190, 226, 226, 115);
          backgroundGraphics.circle(-width * 0.48, height * 0.43, width * 0.48);
          backgroundGraphics.fill();
          backgroundGraphics.fillColor = new Color(247, 221, 157, 105);
          backgroundGraphics.circle(width * 0.52, -height * 0.44, width * 0.5);
          backgroundGraphics.fill();
          backgroundGraphics.fillColor = new Color(104, 192, 165, 30);
          for (var row = 0; row < 7; row += 1) {
            for (var column = 0; column < 4; column += 1) {
              backgroundGraphics.circle(-width * 0.42 + column * 28, -height * 0.1 + row * 28, 4);
            }
          }
          backgroundGraphics.fill();
        }

        // 顶部只保留状态文字和三个圆点，不再使用任何品牌 Logo 图片。
        ;

        _proto.createLoadingHeader = function createLoadingHeader() {
          var header = new Node('LoadingHeader');
          header.setParent(this.node);
          header.setPosition(0, 410, 0);
          header.addComponent(UITransform).setContentSize(520, 120);
          this.createLabel(header, 'Title', '游戏准备中', 38, new Color(43, 98, 107, 255), new Vec3(0, 20, 0), 500, 54);
          this.createLabel(header, 'Subtitle', '正在整理棋盘与数字', 21, new Color(105, 145, 148, 235), new Vec3(0, -25, 0), 420, 36);
          var dots = header.addComponent(Graphics);
          dots.fillColor = new Color(100, 201, 165, 255);
          dots.circle(-26, -58, 5);
          dots.circle(0, -58, 5);
          dots.circle(26, -58, 5);
          dots.fill();
        }

        /**
         * 创建随机提示卡和教程插图。
         *
         * 卡片外壳保持固定，内容则根据 activeTip 生成。技能提示会同时展示游戏内按钮图片和棋盘示意，
         * 普通玩法提示使用轻量 Graphics 图解，因此不会额外引入加载页专用大图资源。
         */;
        _proto.createRandomTipCard = function createRandomTipCard() {
          var card = new Node('TipCard');
          card.setParent(this.node);
          card.setPosition(0, 6, 0);
          card.addComponent(UITransform).setContentSize(TIP_CARD_WIDTH, TIP_CARD_HEIGHT);
          var opacity = card.addComponent(UIOpacity);
          opacity.opacity = 0;
          var graphics = card.addComponent(Graphics);
          graphics.fillColor = new Color(36, 77, 91, 42);
          graphics.roundRect(-TIP_CARD_WIDTH / 2 + 6, -TIP_CARD_HEIGHT / 2 - 10, TIP_CARD_WIDTH, TIP_CARD_HEIGHT, 34);
          graphics.fill();
          graphics.fillColor = new Color(248, 253, 250, 244);
          graphics.roundRect(-TIP_CARD_WIDTH / 2, -TIP_CARD_HEIGHT / 2, TIP_CARD_WIDTH, TIP_CARD_HEIGHT, 34);
          graphics.fill();
          graphics.strokeColor = new Color(255, 255, 255, 210);
          graphics.lineWidth = 3;
          graphics.roundRect(-TIP_CARD_WIDTH / 2 + 2, -TIP_CARD_HEIGHT / 2 + 2, TIP_CARD_WIDTH - 4, TIP_CARD_HEIGHT - 4, 32);
          graphics.stroke();
          this.createCategoryBadge(card, this.activeTip.category);
          this.createLabel(card, 'TipTitle', this.activeTip.title, 34, new Color(43, 98, 107, 255), new Vec3(0, 144, 0), 548, 52);
          this.createLabel(card, 'TipDescription', this.activeTip.description, 23, new Color(91, 126, 132, 255), new Vec3(0, 92, 0), 530, 66);
          var tutorial = new Node('TutorialIllustration');
          tutorial.setParent(card);
          tutorial.setPosition(0, -42, 0);
          tutorial.addComponent(UITransform).setContentSize(540, 202);
          var tutorialGraphics = tutorial.addComponent(Graphics);
          tutorialGraphics.fillColor = new Color(224, 244, 237, 218);
          tutorialGraphics.roundRect(-270, -101, 540, 202, 25);
          tutorialGraphics.fill();
          if (this.isSkillTip(this.activeTip.visual)) {
            this.drawSkillTutorial(tutorial, this.activeTip.visual);
          } else {
            this.drawGameplayTutorial(tutorial, this.activeTip.visual);
          }
          this.createLabel(card, 'RandomTipFootnote', '每次进入，都会遇见一条新提示', 19, new Color(119, 159, 159, 230), new Vec3(0, -218, 0), 480, 32);
          this.tipCardNode = card;
        };
        _proto.createCategoryBadge = function createCategoryBadge(parent, category) {
          var badge = new Node('TipCategory');
          badge.setParent(parent);
          badge.setPosition(0, 207, 0);
          badge.addComponent(UITransform).setContentSize(178, 48);
          var graphics = badge.addComponent(Graphics);
          graphics.fillColor = category === '技能教程' ? new Color(255, 204, 112, 255) : new Color(102, 203, 166, 255);
          graphics.roundRect(-89, -24, 178, 48, 24);
          graphics.fill();
          this.createLabel(badge, 'Label', category, 22, new Color(255, 255, 255, 255), Vec3.ZERO, 170, 40);
        };
        _proto.isSkillTip = function isSkillTip(visual) {
          return visual === 'bomb' || visual === 'hammer' || visual === 'swap';
        }

        /**
         * 绘制技能教程：左侧使用真实技能按钮图片，右侧用小棋盘说明作用范围或操作方向。
         * @param parent 教程插图容器。
         * @param visual 当前技能类型。
         */;
        _proto.drawSkillTutorial = function drawSkillTutorial(parent, visual) {
          var iconFrame = visual === 'bomb' ? this.bombSpriteFrame : visual === 'hammer' ? this.hammerSpriteFrame : this.swapSpriteFrame;
          if (iconFrame) {
            var icon = new Node('SkillIcon');
            icon.setParent(parent);
            icon.setPosition(-182, 12, 0);
            icon.addComponent(UITransform).setContentSize(118, 118);
            var sprite = icon.addComponent(Sprite);
            sprite.spriteFrame = iconFrame;
            sprite.type = Sprite.Type.SIMPLE;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            this.tipIconNode = icon;
          } else {
            this.createTutorialTile(parent, 'SkillFallback', '技能', -182, 12, 96, TILE_COLORS[1], 24);
          }
          var arrow = parent.getComponent(Graphics);
          if (arrow) {
            this.drawArrow(arrow, -108, 12, -55, 12, new Color(70, 143, 144, 230));
          }
          if (visual === 'bomb') {
            this.drawBombDiagram(parent);
            return;
          }
          if (visual === 'hammer') {
            this.drawHammerDiagram(parent);
            return;
          }
          this.drawSwapDiagram(parent);
        };
        _proto.drawBombDiagram = function drawBombDiagram(parent) {
          var size = 48;
          for (var row = 0; row < 3; row += 1) {
            for (var column = 0; column < 3; column += 1) {
              var isCenter = row === 1 && column === 1;
              this.createTutorialTile(parent, "BombCell" + row + column, isCenter ? '✦' : '', 65 + (column - 1) * 54, 18 + (row - 1) * 54, size, isCenter ? new Color(244, 125, 112, 255) : new Color(255, 193, 103, 215), 26);
            }
          }
          this.createLabel(parent, 'BombRangeLabel', '点击中心 · 清除 3×3', 19, new Color(83, 119, 124, 255), new Vec3(65, -78, 0), 250, 28);
        };
        _proto.drawHammerDiagram = function drawHammerDiagram(parent) {
          var _this4 = this;
          var values = ['2', '8', '4'];
          values.forEach(function (value, index) {
            var isTarget = index === 1;
            _this4.createTutorialTile(parent, "HammerCell" + index, isTarget ? '×' : value, 65 + (index - 1) * 72, 18, 62, isTarget ? new Color(244, 125, 112, 255) : TILE_COLORS[index], isTarget ? 38 : 25);
          });
          this.createLabel(parent, 'HammerTargetLabel', '点哪颗 · 敲哪颗', 19, new Color(83, 119, 124, 255), new Vec3(65, -66, 0), 250, 28);
        };
        _proto.drawSwapDiagram = function drawSwapDiagram(parent) {
          this.createTutorialTile(parent, 'SwapLeft', '2', 15, 18, 68, TILE_COLORS[0], 27);
          this.createTutorialTile(parent, 'SwapRight', '4', 115, 18, 68, TILE_COLORS[2], 27);
          var graphics = parent.getComponent(Graphics);
          if (graphics) {
            this.drawArrow(graphics, 50, 38, 80, 38, new Color(70, 143, 144, 230));
            this.drawArrow(graphics, 80, -2, 50, -2, new Color(70, 143, 144, 230));
          }
          this.createLabel(parent, 'SwapDirectionLabel', '拖到相邻格 · 可合并才保留', 18, new Color(83, 119, 124, 255), new Vec3(65, -66, 0), 280, 28);
        }

        /**
         * 根据首页提示类型生成对应的小型玩法图解。
         * @param parent 教程插图容器。
         * @param visual 玩法图解类型。
         */;
        _proto.drawGameplayTutorial = function drawGameplayTutorial(parent, visual) {
          if (visual === 'merge') {
            this.createTutorialTile(parent, 'MergeLeft', '2', -140, 8, 72, TILE_COLORS[0], 29);
            this.createLabel(parent, 'MergePlus', '+', 28, new Color(76, 122, 128, 255), new Vec3(-72, 8, 0), 38, 40);
            this.createTutorialTile(parent, 'MergeRight', '2', -5, 8, 72, TILE_COLORS[0], 29);
            this.createLabel(parent, 'MergeEqual', '=', 28, new Color(76, 122, 128, 255), new Vec3(64, 8, 0), 38, 40);
            this.createTutorialTile(parent, 'MergeResult', '4', 140, 8, 80, TILE_COLORS[1], 31);
            return;
          }
          if (visual === 'drop' || visual === 'plan') {
            this.drawDropDiagram(parent, visual === 'plan');
            return;
          }
          if (visual === 'chain') {
            this.createTutorialTile(parent, 'Chain2', '2', -170, 12, 62, TILE_COLORS[0], 25);
            this.createLabel(parent, 'ChainArrow1', '→', 28, new Color(76, 122, 128, 255), new Vec3(-103, 12, 0), 40, 40);
            this.createTutorialTile(parent, 'Chain4', '4', -35, 12, 70, TILE_COLORS[1], 27);
            this.createLabel(parent, 'ChainArrow2', '→', 28, new Color(76, 122, 128, 255), new Vec3(38, 12, 0), 40, 40);
            this.createTutorialTile(parent, 'Chain8', '8', 115, 12, 82, TILE_COLORS[2], 31);
            this.createLabel(parent, 'ChainLabel', '连锁！', 21, new Color(235, 132, 76, 255), new Vec3(202, 12, 0), 80, 32);
            return;
          }
          this.drawSpaceDiagram(parent);
        };
        _proto.drawDropDiagram = function drawDropDiagram(parent, isPlanningTip) {
          var graphics = parent.getComponent(Graphics);
          var targetColumn = isPlanningTip ? 3 : 2;
          for (var column = 0; column < 5; column += 1) {
            var value = isPlanningTip && (column === 2 || column === 3) ? '2' : column === 1 ? '4' : '';
            this.createTutorialTile(parent, "DropBase" + column, value, -128 + column * 64, -45, 54, value === '2' ? TILE_COLORS[0] : TILE_COLORS[1], 21);
          }
          this.createTutorialTile(parent, 'FallingPiece', isPlanningTip ? '2' : '8', -128 + targetColumn * 64, 54, 58, isPlanningTip ? TILE_COLORS[0] : TILE_COLORS[2], 23);
          if (graphics) {
            this.drawArrow(graphics, -128 + targetColumn * 64, 20, -128 + targetColumn * 64, -12, new Color(70, 143, 144, 230));
          }
        };
        _proto.drawSpaceDiagram = function drawSpaceDiagram(parent) {
          for (var column = 0; column < 5; column += 1) {
            for (var row = 0; row < 2; row += 1) {
              if (column === 3) {
                continue;
              }
              var value = (column + row) % 2 === 0 ? '2' : '4';
              this.createTutorialTile(parent, "SpaceCell" + column + row, value, -128 + column * 64, -30 + row * 62, 54, TILE_COLORS[(column + row) % 2], 20);
            }
          }
          this.createLabel(parent, 'SpaceLabel', '留一列', 20, new Color(235, 132, 76, 255), new Vec3(64, 75, 0), 100, 30);
        };
        _proto.createTutorialTile = function createTutorialTile(parent, name, text, x, y, size, color, fontSize) {
          var tile = new Node(name);
          tile.setParent(parent);
          tile.setPosition(x, y, 0);
          tile.addComponent(UITransform).setContentSize(size, size);
          var graphics = tile.addComponent(Graphics);
          graphics.fillColor = new Color(41, 89, 98, 32);
          graphics.roundRect(-size / 2 + 3, -size / 2 - 4, size, size, 14);
          graphics.fill();
          graphics.fillColor = color;
          graphics.roundRect(-size / 2, -size / 2, size, size, 14);
          graphics.fill();
          if (text) {
            this.createLabel(tile, 'Value', text, fontSize, new Color(255, 255, 255, 255), Vec3.ZERO, size - 6, size - 6);
          }
          return tile;
        };
        _proto.drawArrow = function drawArrow(graphics, startX, startY, endX, endY, color) {
          var angle = Math.atan2(endY - startY, endX - startX);
          var arrowSize = 9;
          graphics.strokeColor = color;
          graphics.lineWidth = 4;
          graphics.moveTo(startX, startY);
          graphics.lineTo(endX, endY);
          graphics.moveTo(endX, endY);
          graphics.lineTo(endX - Math.cos(angle - Math.PI / 6) * arrowSize, endY - Math.sin(angle - Math.PI / 6) * arrowSize);
          graphics.moveTo(endX, endY);
          graphics.lineTo(endX - Math.cos(angle + Math.PI / 6) * arrowSize, endY - Math.sin(angle + Math.PI / 6) * arrowSize);
          graphics.stroke();
        };
        _proto.createLabel = function createLabel(parent, name, text, fontSize, color, position, width, height) {
          var node = new Node(name);
          node.setParent(parent);
          node.setPosition(position);
          node.addComponent(UITransform).setContentSize(width, height);
          var label = node.addComponent(Label);
          label.string = text;
          label.fontSize = fontSize;
          label.lineHeight = Math.round(fontSize * 1.35);
          label.color = color;
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
          label.overflow = Label.Overflow.SHRINK;
          return label;
        }

        // 卡片淡入并轻微上浮；技能图片额外做小幅呼吸，让静态教程更容易被注意到。
        ;

        _proto.playEntranceAnimation = function playEntranceAnimation() {
          if (!this.tipCardNode) {
            return;
          }
          var opacity = this.tipCardNode.getComponent(UIOpacity);
          this.tipCardNode.setScale(new Vec3(0.94, 0.94, 1));
          this.tipCardNode.setPosition(0, -10, 0);
          tween(this.tipCardNode).parallel(tween().to(0.32, {
            scale: Vec3.ONE
          }, {
            easing: 'backOut'
          }), tween().to(0.32, {
            position: new Vec3(0, 6, 0)
          }, {
            easing: 'quadOut'
          })).start();
          if (opacity) {
            tween(opacity).to(0.2, {
              opacity: 255
            }, {
              easing: 'quadOut'
            }).start();
          }
          if (this.tipIconNode) {
            tween(this.tipIconNode).repeatForever(tween().to(0.72, {
              position: new Vec3(-182, 18, 0)
            }, {
              easing: 'sineInOut'
            }).to(0.72, {
              position: new Vec3(-182, 8, 0)
            }, {
              easing: 'sineInOut'
            })).start();
          }
        }

        // 没有层级进度条时，脚本补一条简洁进度条，确保加载页最小可用。
        ;

        _proto.createFallbackProgressBar = function createFallbackProgressBar() {
          var track = new Node('ProgressTrack');
          track.setParent(this.node);
          track.setPosition(0, DEFAULT_PROGRESS_Y, 0);
          track.addComponent(UITransform).setContentSize(DEFAULT_PROGRESS_WIDTH, DEFAULT_PROGRESS_HEIGHT);
          var trackGraphics = track.addComponent(Graphics);
          trackGraphics.fillColor = new Color(26, 61, 78, 142);
          trackGraphics.roundRect(-DEFAULT_PROGRESS_WIDTH / 2, -DEFAULT_PROGRESS_HEIGHT / 2, DEFAULT_PROGRESS_WIDTH, DEFAULT_PROGRESS_HEIGHT, DEFAULT_PROGRESS_HEIGHT / 2);
          trackGraphics.fill();
          var fill = new Node('ProgressFill');
          fill.setParent(track);
          fill.setPosition(-DEFAULT_PROGRESS_WIDTH / 2, 0, 0);
          var fillTransform = fill.addComponent(UITransform);
          fillTransform.setContentSize(DEFAULT_PROGRESS_WIDTH, DEFAULT_PROGRESS_HEIGHT);
          fill.setScale(new Vec3(0, 1, 1));
          var fillGraphics = fill.addComponent(Graphics);
          fillGraphics.fillColor = new Color(41, 215, 129, 255);
          // 填充条从节点原点向右绘制，节点固定在轨道左边缘，刷新进度时只改 scaleX。
          fillGraphics.roundRect(0, -DEFAULT_PROGRESS_HEIGHT / 2, DEFAULT_PROGRESS_WIDTH, DEFAULT_PROGRESS_HEIGHT, DEFAULT_PROGRESS_HEIGHT / 2);
          fillGraphics.fill();
          this.progressTrackNode = track;
          this.progressFillNode = fill;
        };
        _proto.createFallbackPercentLabel = function createFallbackPercentLabel() {
          var labelNode = new Node('PercentLabel');
          labelNode.setParent(this.node);
          labelNode.setPosition(0, DEFAULT_LABEL_Y, 0);
          labelNode.addComponent(UITransform).setContentSize(360, 48);
          var label = labelNode.addComponent(Label);
          label.string = '正在准备游戏 · 0%';
          label.fontSize = 24;
          label.lineHeight = 30;
          // 新背景是浅色纯色底，进度文案改用深青色保证移动端户外环境下仍清晰可读。
          label.color = new Color(66, 111, 117, 235);
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
          return label;
        };
        _proto.renderProgress = function renderProgress(progress) {
          var _this$progressFillNod2;
          var normalizedProgress = Math.max(0, Math.min(1, progress));
          (_this$progressFillNod2 = this.progressFillNode) == null || _this$progressFillNod2.setScale(new Vec3(normalizedProgress, 1, 1));
          if (this.percentLabel) {
            var percentage = Math.round(normalizedProgress * 100);
            this.percentLabel.string = percentage >= 100 ? '准备完成 · 100%' : "\u6B63\u5728\u51C6\u5907\u6E38\u620F \xB7 " + percentage + "%";
          }
        }

        // 层级里可能多包了一层容器，递归查找可以减少手动拖引用的必要。
        ;

        _proto.findChildDeep = function findChildDeep(parent, name) {
          var directChild = parent.getChildByName(name);
          if (directChild) {
            return directChild;
          }
          for (var _iterator = _createForOfIteratorHelperLoose(parent.children), _step; !(_step = _iterator()).done;) {
            var child = _step.value;
            var matched = this.findChildDeep(child, name);
            if (matched) {
              return matched;
            }
          }
          return null;
        };
        return LoadingSceneController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "targetSceneName", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 'game';
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "minimumDisplaySeconds", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 1.8;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "bombSpriteFrame", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "hammerSpriteFrame", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "swapSpriteFrame", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "backgroundNodeRef", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "progressFillNodeRef", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "percentLabelNodeRef", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/main", ['./BoardGeometry.ts', './BoardModel.ts', './GameAudioManager.ts', './GameFeedbackAdapter.ts', './GameOverOverlayController.ts', './GameShareAdapter.ts', './HomeSceneController.ts', './LoadingSceneController.ts', './PauseOverlayController.ts', './PieceController.ts', './PlayController.ts', './PlayUIController.ts', './PlayerEconomyStore.ts', './ScoreManager.ts', './SkillShopPopupController.ts', './SkillStock.ts', './StartPageController.ts', './TransientFxRegistry.ts'], function () {
  return {
    setters: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    execute: function () {}
  };
});

System.register("chunks:///_virtual/PauseOverlayController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, _createForOfIteratorHelperLoose, cclegacy, _decorator, Color, Node, UITransform, Sprite, Graphics, Label, Vec3, Tween, UIOpacity, sys, AudioSource, tween, Component;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Color = module.Color;
      Node = module.Node;
      UITransform = module.UITransform;
      Sprite = module.Sprite;
      Graphics = module.Graphics;
      Label = module.Label;
      Vec3 = module.Vec3;
      Tween = module.Tween;
      UIOpacity = module.UIOpacity;
      sys = module.sys;
      AudioSource = module.AudioSource;
      tween = module.tween;
      Component = module.Component;
    }],
    execute: function () {
      var _dec, _dec2, _class, _class2, _descriptor;
      cclegacy._RF.push({}, "127c7V7CthM2qIeFWjDL2H7", "PauseOverlayController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;

      // 暂停面板滑入滑出的动画时长。
      var PAUSE_PANEL_ANIM_DURATION = 0.26;
      // 暂停蒙版淡入淡出的动画时长。
      var PAUSE_MASK_ANIM_DURATION = 0.18;
      // 暂停面板完全滑出屏幕右侧后额外保留一点距离，避免边缘露在屏幕内。
      var PAUSE_PANEL_HIDDEN_GAP = 32;
      // 背景音乐音量本地存储键。
      var AUDIO_MUSIC_VOLUME_KEY = 'play.audio.musicVolume';
      // 音效音量本地存储键。
      var AUDIO_SOUND_EFFECT_KEY = 'play.audio.soundEffectVolume';
      // 游戏内设置面板统一尺寸；在 750 宽设计分辨率下保留两侧 65 像素安全边距。
      var PAUSE_PANEL_WIDTH = 620;
      var PAUSE_PANEL_HEIGHT = 760;
      var PAUSE_ACTION_BUTTON_WIDTH = 250;
      var PAUSE_ACTION_BUTTON_HEIGHT = 68;
      var PAUSE_CONTINUE_BUTTON_WIDTH = 320;
      var PAUSE_CONTINUE_BUTTON_HEIGHT = 76;
      var PAUSE_PANEL_BORDER = new Color(93, 62, 42, 245);
      var PAUSE_PANEL_FILL = new Color(255, 249, 224, 252);
      var PAUSE_TEXT_COLOR = new Color(81, 55, 37, 255);
      var GENERATED_BACKGROUND_NAME = 'GeneratedBackground';
      var PauseOverlayController = exports('PauseOverlayController', (_dec = ccclass('PauseOverlayController'), _dec2 = property({
        type: Node,
        tooltip: '关闭按钮节点'
      }), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(PauseOverlayController, _Component);
        function PauseOverlayController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          // 持有 play 根节点引用，方便复用背景图和同步整局的音频源。
          _this.hostNode = null;
          // 半透明蒙版节点，只负责遮罩和拦截触摸。
          _this.pauseOverlayMask = null;
          // 右侧滑入的弹窗面板节点。
          _this.pauseOverlayPanel = null;
          // 记录面板在 scene 中配置好的最终显示位置，打开弹窗时滑到这里。
          _this.pausePanelShownPosition = null;
          // 背景音乐控制行容器。
          _this.bgMusicControl = null;
          // 背景音乐滑块根节点。
          _this.bgMusicSlider = null;
          // 背景音乐滑块空槽节点。
          _this.bgMusicSliderBase = null;
          // 背景音乐滑块填充节点。
          _this.bgMusicFill = null;
          // 背景音乐滑块控制点节点。
          _this.bgMusicController = null;
          // 背景音乐滑块控制点在 scene 中配置的最左和最右位置。
          _this.bgMusicControllerMinX = 0;
          _this.bgMusicControllerMaxX = 0;
          // 音效控制行容器。
          _this.soundEffectControl = null;
          // 音效滑块根节点。
          _this.soundEffectSlider = null;
          // 音效滑块空槽节点。
          _this.soundEffectSliderBase = null;
          // 音效滑块填充节点。
          _this.soundEffectFill = null;
          // 音效滑块控制点节点。
          _this.soundEffectController = null;
          // 音效滑块控制点在 scene 中配置的最左和最右位置。
          _this.soundEffectControllerMinX = 0;
          _this.soundEffectControllerMaxX = 0;
          // 当前背景音乐音量，范围固定在 0 到 1。
          _this.bgMusicVolume = 1;
          // 当前音效音量，范围固定在 0 到 1。
          _this.soundEffectVolume = 1;
          // 记录当前暂停状态，只让弹窗脚本关心自己是否该显示。
          _this.isPaused = false;
          // 由逻辑层注入的暂停切换回调，按钮点击后只通知逻辑，不直接改游戏状态。
          _this.pauseHandler = null;
          // 暂停层重玩按钮只通知逻辑层重开当前对局。
          _this.replayHandler = null;
          // 暂停层回首页按钮只通知逻辑层保存对局并切换到首页场景。
          _this.homeHandler = null;
          // 分享和反馈只派发平台意图，暂停组件自身不访问平台 API。
          _this.shareHandler = null;
          _this.feedbackHandler = null;
          // 回首页会销毁当前游戏场景，点击后只派发一次，避免连续触摸重复触发解绑和切场景。
          _this.isReturningHome = false;
          // 关闭弹窗的按钮
          _initializerDefineProperty(_this, "closeButtonNode", _descriptor, _assertThisInitialized(_this));
          // 面板里的 Play/继续按钮，点击后和关闭按钮一样通知逻辑层恢复游戏。
          _this.playButtonNode = null;
          // 层级管理器中配置的重玩按钮节点，兼容当前 Repay 命名和标准 Replay 命名。
          _this.replayButtonNode = null;
          // 层级管理器中配置的回首页按钮节点。
          _this.homeButtonNode = null;
          _this.shareButtonNode = null;
          _this.feedbackButtonNode = null;
          _this.utilityActionsNode = null;
          _this.gameActionsNode = null;
          return _this;
        }
        var _proto = PauseOverlayController.prototype;
        // 由外部 UI 组件在启动时调用，把 play 根节点传进来；暂停层只绑定已有按钮，不创建额外层级。
        _proto.setup = function setup(options) {
          this.hostNode = options.hostNode;
          this.pauseHandler = options.pauseHandler;
          this.replayHandler = options.replayHandler;
          this.homeHandler = options.homeHandler;
          this.shareHandler = options.shareHandler;
          this.feedbackHandler = options.feedbackHandler;
          this.isReturningHome = false;
          this.ensureOverlayStructure();
          this.ensurePauseOverlayMaskSprite();
          this.bindPauseOverlayMask();
          this.ensureAudioControls();
          this.configurePausePanelLayout();
          this.bindPlayButton();
          this.bindPauseActionButtons();
          this.layoutPauseActionButtons();
          this.refreshPauseOverlay();

          // 绑定关闭按钮事件，点击后调用 pauseHandler 继续游戏
          this.safeOff(this.closeButtonNode, Node.EventType.TOUCH_END, this.onCloseButtonTap);
          this.safeOn(this.closeButtonNode, Node.EventType.TOUCH_END, this.onCloseButtonTap);
        }

        // 某些平台安全区和尺寸会在首帧后稳定，这里补一次遮罩和滑块布局收口。
        ;

        _proto.syncLayout = function syncLayout() {
          if (this.isReturningHome) {
            return;
          }
          this.ensurePauseOverlayMaskSprite();
          this.configurePausePanelLayout();
          this.configureAudioControlLayout();
          this.layoutPauseActionButtons();
          this.refreshAudioControls();
          this.refreshPauseOverlay();
        }

        // 外部只需要告诉暂停层当前是否暂停，具体动画和显示细节全部交给弹窗脚本。
        ;

        _proto.renderState = function renderState(isPaused) {
          if (this.isReturningHome) {
            return;
          }
          this.isPaused = isPaused;
          this.refreshPauseOverlay();
        };
        _proto.onDestroy = function onDestroy() {
          this.unscheduleAllCallbacks();
          this.stopPauseOverlayTweens();
          this.safeOff(this.pauseOverlayMask, Node.EventType.TOUCH_START, this.swallowOverlayTouch);
          this.safeOff(this.pauseOverlayMask, Node.EventType.TOUCH_MOVE, this.swallowOverlayTouch);
          this.safeOff(this.pauseOverlayMask, Node.EventType.TOUCH_END, this.swallowOverlayTouch);
          this.safeOff(this.pauseOverlayMask, Node.EventType.TOUCH_CANCEL, this.swallowOverlayTouch);
          this.unbindSliderTouchEvents([this.bgMusicControl, this.bgMusicSlider, this.bgMusicController], this.onBgMusicControlTouch);
          this.unbindSliderTouchEvents([this.soundEffectControl, this.soundEffectSlider, this.soundEffectController], this.onSoundEffectControlTouch);
          this.safeOff(this.closeButtonNode, Node.EventType.TOUCH_END, this.onCloseButtonTap);
          this.unbindPauseActionButton(this.playButtonNode, this.onCloseButtonTap);
          this.unbindPauseActionButton(this.replayButtonNode, this.onReplayButtonTap);
          this.unbindPauseActionButton(this.homeButtonNode, this.onHomeButtonTap);
          this.unbindPauseActionButton(this.shareButtonNode, this.onShareButtonTap);
          this.unbindPauseActionButton(this.feedbackButtonNode, this.onFeedbackButtonTap);
        }

        // PauseOverlay 节点优先复用 scene 中现成的 Mask 和 Panel，缺失时再补最小结构。
        ;

        _proto.ensureOverlayStructure = function ensureOverlayStructure() {
          var _this$node$getCompone;
          this.node.active = false;
          // 暂停层必须压在棋子和特效上方，避免打开弹窗后仍被运行时节点遮挡。
          this.bringNodeToTop(this.node);
          var overlayTransform = (_this$node$getCompone = this.node.getComponent(UITransform)) != null ? _this$node$getCompone : this.node.addComponent(UITransform);
          if (overlayTransform.width <= 0 || overlayTransform.height <= 0) {
            overlayTransform.setContentSize(750, 1334);
          }
          var mask = this.node.getChildByName('Mask');
          if (!mask) {
            mask = new Node('Mask');
            mask.setParent(this.node);
            var maskTransform = mask.addComponent(UITransform);
            maskTransform.setContentSize(overlayTransform.width, overlayTransform.height);
            mask.addComponent(Sprite);
          }
          this.pauseOverlayMask = mask;
          var panel = this.node.getChildByName('Panel');
          if (!panel) {
            panel = new Node('Panel');
            panel.setParent(this.node);
            var panelTransform = panel.addComponent(UITransform);
            panelTransform.setContentSize(360, 560);
            panel.addComponent(Sprite);
            panel.setPosition(150, 0, 0);
          }
          this.pauseOverlayPanel = panel;
          this.pausePanelShownPosition = panel.position.clone();
        }

        // 设置面板使用固定信息区和动作区，避免旧版大图决定排版，也避免操作按钮游离在弹窗外。
        ;

        _proto.configurePausePanelLayout = function configurePausePanelLayout() {
          var _panel$getComponent, _titleNode$getCompone, _this$closeButtonNode;
          var panel = this.pauseOverlayPanel;
          if (!panel) {
            return;
          }
          var panelTransform = (_panel$getComponent = panel.getComponent(UITransform)) != null ? _panel$getComponent : panel.addComponent(UITransform);
          panelTransform.setContentSize(PAUSE_PANEL_WIDTH, PAUSE_PANEL_HEIGHT);
          var panelSprite = panel.getComponent(Sprite);
          if (panelSprite) {
            panelSprite.enabled = false;
          }

          // Panel 历史节点已经挂有 Sprite；Cocos 同一节点不能同时拥有两个可渲染组件，
          // 因此把程序绘制背景放到独立子节点，既避免组件冲突，也能稳定压在内容下方。
          var panelBackground = this.ensureGraphicsBackground(panel, PAUSE_PANEL_WIDTH, PAUSE_PANEL_HEIGHT);
          var panelGraphics = panelBackground.getComponent(Graphics);
          panelGraphics.clear();
          panelGraphics.fillColor = new Color(61, 43, 31, 90);
          panelGraphics.roundRect(-PAUSE_PANEL_WIDTH * 0.5 + 8, -PAUSE_PANEL_HEIGHT * 0.5 - 10, PAUSE_PANEL_WIDTH, PAUSE_PANEL_HEIGHT, 44);
          panelGraphics.fill();
          panelGraphics.fillColor = PAUSE_PANEL_BORDER;
          panelGraphics.roundRect(-PAUSE_PANEL_WIDTH * 0.5, -PAUSE_PANEL_HEIGHT * 0.5, PAUSE_PANEL_WIDTH, PAUSE_PANEL_HEIGHT, 44);
          panelGraphics.fill();
          panelGraphics.fillColor = PAUSE_PANEL_FILL;
          panelGraphics.roundRect(-PAUSE_PANEL_WIDTH * 0.5 + 5, -PAUSE_PANEL_HEIGHT * 0.5 + 5, PAUSE_PANEL_WIDTH - 10, PAUSE_PANEL_HEIGHT - 10, 39);
          panelGraphics.fill();
          var titleNode = panel.getChildByName('SettingLabel');
          var titleLabel = (_titleNode$getCompone = titleNode == null ? void 0 : titleNode.getComponent(Label)) != null ? _titleNode$getCompone : null;
          if (titleNode && titleLabel) {
            var _titleNode$getCompone2;
            titleNode.setPosition(0, 315, 0);
            (_titleNode$getCompone2 = titleNode.getComponent(UITransform)) == null || _titleNode$getCompone2.setContentSize(280, 58);
            titleLabel.string = '游戏设置';
            titleLabel.fontSize = 38;
            titleLabel.lineHeight = 48;
            titleLabel.color = PAUSE_TEXT_COLOR;
            titleLabel.isBold = true;
            titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            titleLabel.verticalAlign = Label.VerticalAlign.CENTER;
          }
          this.closeButtonNode = (_this$closeButtonNode = this.closeButtonNode) != null ? _this$closeButtonNode : panel.getChildByName('CloseBtn');
          if (this.closeButtonNode) {
            var _this$closeButtonNode2;
            this.closeButtonNode.setPosition(260, 316, 0);
            (_this$closeButtonNode2 = this.closeButtonNode.getComponent(UITransform)) == null || _this$closeButtonNode2.setContentSize(64, 64);
          }
          this.layoutAudioControl(this.bgMusicControl, 188, '音乐音量');
          this.layoutAudioControl(this.soundEffectControl, 94, '音效音量');
        };
        _proto.layoutAudioControl = function layoutAudioControl(control, y, title) {
          var _control$children$fin, _labelNode$getCompone;
          if (!this.canUseNode(control)) {
            return;
          }
          control.setPosition(-165, y, 0);
          var labelNode = (_control$children$fin = control.children.find(function (child) {
            return !!child.getComponent(Label);
          })) != null ? _control$children$fin : null;
          var label = (_labelNode$getCompone = labelNode == null ? void 0 : labelNode.getComponent(Label)) != null ? _labelNode$getCompone : null;
          if (labelNode && label) {
            labelNode.setPosition(70, labelNode.position.y, labelNode.position.z);
            label.string = title;
            label.fontSize = 24;
            label.lineHeight = 30;
            label.color = PAUSE_TEXT_COLOR;
            label.isBold = true;
          }
        }

        // 蒙版层只负责拦截触摸，防止暂停时点穿到底层棋盘和控制栏。
        ;

        _proto.swallowOverlayTouch = function swallowOverlayTouch(event) {
          event.propagationStopped = true;
        };
        _proto.onCloseButtonTap = function onCloseButtonTap(event) {
          var _this$pauseHandler;
          event.propagationStopped = true;
          (_this$pauseHandler = this.pauseHandler) == null || _this$pauseHandler.call(this);
        };
        _proto.onReplayButtonTap = function onReplayButtonTap(event) {
          var _this$replayHandler;
          event.propagationStopped = true;
          (_this$replayHandler = this.replayHandler) == null || _this$replayHandler.call(this);
        };
        _proto.onHomeButtonTap = function onHomeButtonTap(event) {
          var _this2 = this;
          event.propagationStopped = true;
          if (this.isReturningHome) {
            return;
          }
          this.isReturningHome = true;
          this.stopPauseOverlayTweens();
          // 等当前 TOUCH_END 派发结束后再切场景，避免按钮节点被销毁时事件系统还在继续访问它。
          this.scheduleOnce(function () {
            return _this2.homeHandler == null ? void 0 : _this2.homeHandler();
          }, 0);
        };
        _proto.onShareButtonTap = function onShareButtonTap(event) {
          var _this$shareHandler;
          event.propagationStopped = true;
          (_this$shareHandler = this.shareHandler) == null || _this$shareHandler.call(this);
        };
        _proto.onFeedbackButtonTap = function onFeedbackButtonTap(event) {
          var _this$feedbackHandler;
          event.propagationStopped = true;
          (_this$feedbackHandler = this.feedbackHandler) == null || _this$feedbackHandler.call(this);
        }

        // Play 按钮是暂停面板里已有的继续按钮，兼容旧命名 Save 和 Continue。
        ;

        _proto.bindPlayButton = function bindPlayButton() {
          this.playButtonNode = this.findExistingPauseActionNode(['Play', 'Save', 'Continue']);
          if (this.playButtonNode) {
            this.stylePauseButton(this.playButtonNode, '继续游戏', PAUSE_CONTINUE_BUTTON_WIDTH, PAUSE_CONTINUE_BUTTON_HEIGHT, new Color(112, 185, 117, 255), '▶');
          }
          this.bindPauseActionButton(this.playButtonNode, this.onCloseButtonTap);
        }

        // 固定按钮优先复用 Scene 节点；迁移期缺失的分享、反馈挂点只补到明确的固定容器中。
        ;

        _proto.bindPauseActionButtons = function bindPauseActionButtons() {
          this.replayButtonNode = this.findExistingPauseActionNode(['Repay', 'Replay']);
          this.homeButtonNode = this.findExistingPauseActionNode(['Home']);
          this.ensurePauseActionStructure();
          this.bindPauseActionButton(this.replayButtonNode, this.onReplayButtonTap);
          this.bindPauseActionButton(this.homeButtonNode, this.onHomeButtonTap);
          this.bindPauseActionButton(this.shareButtonNode, this.onShareButtonTap);
          this.bindPauseActionButton(this.feedbackButtonNode, this.onFeedbackButtonTap);
        }

        // 游戏操作在面板内同一行等宽排布；安全区由整个面板居中解决，不再把按钮散落到屏幕两角。
        ;

        _proto.layoutPauseActionButtons = function layoutPauseActionButtons() {
          var _this$utilityActionsN, _this$gameActionsNode;
          if (!this.pauseOverlayPanel) {
            return;
          }
          (_this$utilityActionsN = this.utilityActionsNode) == null || _this$utilityActionsN.setPosition(0, -24, 0);
          (_this$gameActionsNode = this.gameActionsNode) == null || _this$gameActionsNode.setPosition(0, -120, 0);
          if (this.canUseNode(this.shareButtonNode)) {
            this.shareButtonNode.setPosition(-140, 0, 0);
          }
          if (this.canUseNode(this.feedbackButtonNode)) {
            this.feedbackButtonNode.setPosition(140, 0, 0);
          }
          if (this.canUseNode(this.homeButtonNode)) {
            this.homeButtonNode.setPosition(-140, 0, 0);
          }
          if (this.canUseNode(this.replayButtonNode)) {
            this.replayButtonNode.setPosition(140, 0, 0);
          }
          if (this.canUseNode(this.playButtonNode)) {
            this.playButtonNode.setPosition(0, -235, 0);
          }
        };
        _proto.ensurePauseActionStructure = function ensurePauseActionStructure() {
          var _this$findChildDeep, _this$findChildDeep2;
          var panel = this.pauseOverlayPanel;
          if (!panel) {
            return;
          }
          this.utilityActionsNode = this.ensureContainer(panel, 'UtilityActions', 560, PAUSE_ACTION_BUTTON_HEIGHT);
          this.gameActionsNode = this.ensureContainer(panel, 'GameActions', 560, PAUSE_ACTION_BUTTON_HEIGHT);
          this.shareButtonNode = (_this$findChildDeep = this.findChildDeep(panel, ['ShareButton', 'Share'])) != null ? _this$findChildDeep : this.createActionNode(this.utilityActionsNode, 'ShareButton');
          this.feedbackButtonNode = (_this$findChildDeep2 = this.findChildDeep(panel, ['FeedbackButton', 'Feedback'])) != null ? _this$findChildDeep2 : this.createActionNode(this.utilityActionsNode, 'FeedbackButton');
          this.moveNodeToContainer(this.shareButtonNode, this.utilityActionsNode);
          this.moveNodeToContainer(this.feedbackButtonNode, this.utilityActionsNode);
          this.moveNodeToContainer(this.homeButtonNode, this.gameActionsNode);
          this.moveNodeToContainer(this.replayButtonNode, this.gameActionsNode);
          this.stylePauseButton(this.shareButtonNode, '转发好友', PAUSE_ACTION_BUTTON_WIDTH, PAUSE_ACTION_BUTTON_HEIGHT, new Color(255, 183, 91, 255), '↗');
          this.stylePauseButton(this.feedbackButtonNode, '客服反馈', PAUSE_ACTION_BUTTON_WIDTH, PAUSE_ACTION_BUTTON_HEIGHT, new Color(102, 194, 199, 255), '✉');
          this.stylePauseButton(this.homeButtonNode, '返回首页', PAUSE_ACTION_BUTTON_WIDTH, PAUSE_ACTION_BUTTON_HEIGHT, new Color(116, 183, 210, 255), '⌂');
          this.stylePauseButton(this.replayButtonNode, '重新开始', PAUSE_ACTION_BUTTON_WIDTH, PAUSE_ACTION_BUTTON_HEIGHT, new Color(242, 139, 105, 255), '↻');
        };
        _proto.ensureContainer = function ensureContainer(parent, name, width, height) {
          var _container$getCompone;
          var container = parent.getChildByName(name);
          if (!container) {
            container = new Node(name);
            container.setParent(parent);
            container.addComponent(UITransform);
          }
          var transform = (_container$getCompone = container.getComponent(UITransform)) != null ? _container$getCompone : container.addComponent(UITransform);
          transform.setContentSize(width, height);
          return container;
        };
        _proto.createActionNode = function createActionNode(parent, name) {
          var node = new Node(name);
          node.setParent(parent);
          node.addComponent(UITransform);
          return node;
        };
        _proto.moveNodeToContainer = function moveNodeToContainer(node, container) {
          if (!this.canUseNode(node) || !this.canUseNode(container) || node.parent === container) {
            return;
          }
          node.setParent(container);
        }

        // 迁移阶段保留旧按钮图片作为小图标，按钮底板统一改为轻量矢量胶囊以避免拉伸和额外贴图。
        ;

        _proto.stylePauseButton = function stylePauseButton(node, text, width, height, fillColor, fallbackIcon) {
          var _node$getComponent, _glyphNode$getCompone, _glyphNode$getCompone2, _icon$getComponent, _labelNode$getCompone2, _labelNode$getCompone3;
          if (!this.canUseNode(node)) {
            return;
          }
          var transform = (_node$getComponent = node.getComponent(UITransform)) != null ? _node$getComponent : node.addComponent(UITransform);
          transform.setContentSize(width, height);
          var rootSprite = node.getComponent(Sprite);
          // 旧按钮可能还带着尺寸很大的 Label/Sprite 子节点，只保留重构后的背景、图标和文字。
          for (var _iterator = _createForOfIteratorHelperLoose(node.children), _step; !(_step = _iterator()).done;) {
            var child = _step.value;
            if (child.name !== GENERATED_BACKGROUND_NAME && child.name !== 'Icon' && child.name !== 'Text') {
              child.active = false;
            }
          }
          var icon = node.getChildByName('Icon');
          if (!icon) {
            icon = new Node('Icon');
            icon.setParent(node);
            icon.addComponent(UITransform);
          }
          icon.active = true;
          icon.setPosition(-width * 0.5 + 42, 0, 0);

          // 历史按钮贴图的留白和原始尺寸差异很大，压缩成小图标后仍会显得忽大忽小。
          // 设置页统一使用轻量符号图标，保持四个操作按钮的视觉重量一致。
          var legacyIconSprite = icon.getComponent(Sprite);
          if (legacyIconSprite) {
            legacyIconSprite.enabled = false;
          }
          var legacyIconLabel = icon.getComponent(Label);
          if (legacyIconLabel) {
            legacyIconLabel.enabled = false;
          }
          var glyphNode = icon.getChildByName('Glyph');
          if (!glyphNode) {
            glyphNode = new Node('Glyph');
            glyphNode.setParent(icon);
            glyphNode.addComponent(UITransform);
            glyphNode.addComponent(Label);
          }
          glyphNode.active = true;
          glyphNode.setPosition(Vec3.ZERO);
          (_glyphNode$getCompone = glyphNode.getComponent(UITransform)) == null || _glyphNode$getCompone.setContentSize(44, 44);
          var iconLabel = (_glyphNode$getCompone2 = glyphNode.getComponent(Label)) != null ? _glyphNode$getCompone2 : glyphNode.addComponent(Label);
          iconLabel.string = fallbackIcon;
          iconLabel.fontSize = 28;
          iconLabel.lineHeight = 34;
          iconLabel.color = new Color(255, 253, 235, 255);
          iconLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
          iconLabel.verticalAlign = Label.VerticalAlign.CENTER;
          (_icon$getComponent = icon.getComponent(UITransform)) == null || _icon$getComponent.setContentSize(44, 44);
          if (rootSprite) {
            rootSprite.enabled = false;
          }
          var background = this.ensureGraphicsBackground(node, width, height);
          var graphics = background.getComponent(Graphics);
          graphics.clear();
          graphics.fillColor = PAUSE_PANEL_BORDER;
          graphics.roundRect(-width * 0.5, -height * 0.5, width, height, height * 0.5);
          graphics.fill();
          graphics.fillColor = fillColor;
          graphics.roundRect(-width * 0.5 + 4, -height * 0.5 + 4, width - 8, height - 8, height * 0.5 - 4);
          graphics.fill();
          var labelNode = node.getChildByName('Text');
          if (!labelNode) {
            labelNode = new Node('Text');
            labelNode.setParent(node);
            labelNode.addComponent(UITransform);
            labelNode.addComponent(Label);
          }
          labelNode.setPosition(25, 0, 0);
          labelNode.active = true;
          (_labelNode$getCompone2 = labelNode.getComponent(UITransform)) == null || _labelNode$getCompone2.setContentSize(width - 84, height - 8);
          var label = (_labelNode$getCompone3 = labelNode.getComponent(Label)) != null ? _labelNode$getCompone3 : labelNode.addComponent(Label);
          label.string = text;
          label.fontSize = height >= 74 ? 27 : 23;
          label.lineHeight = height >= 74 ? 34 : 30;
          label.color = new Color(255, 253, 235, 255);
          label.isBold = true;
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
        }

        /**
         * 为已有 UI 节点补一个只负责程序绘制的背景层。
         *
         * 历史 Scene 中的 Panel、Play、Home、Repay 已经挂有 Sprite，直接在根节点添加 Graphics
         * 会触发“同一节点存在多个 Renderable”警告。独立背景子节点能保留点击区域和序列化引用，
         * 同时让重构后的胶囊按钮不再受旧贴图原始尺寸影响。
         */;
        _proto.ensureGraphicsBackground = function ensureGraphicsBackground(parent, width, height) {
          var _background$getCompon;
          var background = parent.getChildByName(GENERATED_BACKGROUND_NAME);
          if (!background) {
            background = new Node(GENERATED_BACKGROUND_NAME);
            background.setParent(parent);
            background.addComponent(UITransform);
            background.addComponent(Graphics);
          }
          background.active = true;
          background.setPosition(Vec3.ZERO);
          background.setSiblingIndex(0);
          var transform = (_background$getCompon = background.getComponent(UITransform)) != null ? _background$getCompon : background.addComponent(UITransform);
          transform.setContentSize(width, height);
          return background;
        }

        // 按钮可能已经迁移到动作容器，递归查找可以兼容旧 Scene 和新 Scene 两种层级。
        ;

        _proto.findExistingPauseActionNode = function findExistingPauseActionNode(names) {
          var parents = [this.node, this.pauseOverlayPanel, this.pauseOverlayMask];
          for (var _i = 0, _parents = parents; _i < _parents.length; _i++) {
            var parent = _parents[_i];
            if (!parent) {
              continue;
            }
            var node = this.findChildDeep(parent, names);
            if (node) {
              return node;
            }
          }
          return null;
        };
        _proto.findChildDeep = function findChildDeep(parent, names) {
          for (var _iterator2 = _createForOfIteratorHelperLoose(parent.children), _step2; !(_step2 = _iterator2()).done;) {
            var child = _step2.value;
            if (names.indexOf(child.name) >= 0) {
              return child;
            }
            var nested = this.findChildDeep(child, names);
            if (nested) {
              return nested;
            }
          }
          return null;
        }

        // 按钮节点自己拦截触摸过程，避免事件继续传到底层棋盘或遮罩。
        ;

        _proto.bindPauseActionButton = function bindPauseActionButton(node, endHandler) {
          if (!this.canUseNode(node)) {
            return;
          }
          this.unbindPauseActionButton(node, endHandler);
          node.on(Node.EventType.TOUCH_START, this.swallowOverlayTouch, this);
          node.on(Node.EventType.TOUCH_MOVE, this.swallowOverlayTouch, this);
          node.on(Node.EventType.TOUCH_CANCEL, this.swallowOverlayTouch, this);
          node.on(Node.EventType.TOUCH_END, endHandler, this);
        }

        // 销毁或重复 setup 前统一解绑，避免一次点击触发多次回调。
        ;

        _proto.unbindPauseActionButton = function unbindPauseActionButton(node, endHandler) {
          if (!this.canUseNode(node)) {
            return;
          }
          node.off(Node.EventType.TOUCH_START, this.swallowOverlayTouch, this);
          node.off(Node.EventType.TOUCH_MOVE, this.swallowOverlayTouch, this);
          node.off(Node.EventType.TOUCH_CANCEL, this.swallowOverlayTouch, this);
          node.off(Node.EventType.TOUCH_END, endHandler, this);
        }

        // 给蒙版补上统一的拦截事件绑定，避免重复绑定导致回调执行多次。
        ;

        _proto.bindPauseOverlayMask = function bindPauseOverlayMask() {
          var maskNode = this.pauseOverlayMask;
          if (!this.canUseNode(maskNode)) {
            return;
          }
          this.safeOff(maskNode, Node.EventType.TOUCH_START, this.swallowOverlayTouch);
          this.safeOff(maskNode, Node.EventType.TOUCH_MOVE, this.swallowOverlayTouch);
          this.safeOff(maskNode, Node.EventType.TOUCH_END, this.swallowOverlayTouch);
          this.safeOff(maskNode, Node.EventType.TOUCH_CANCEL, this.swallowOverlayTouch);
          maskNode.on(Node.EventType.TOUCH_START, this.swallowOverlayTouch, this);
          maskNode.on(Node.EventType.TOUCH_MOVE, this.swallowOverlayTouch, this);
          maskNode.on(Node.EventType.TOUCH_END, this.swallowOverlayTouch, this);
          maskNode.on(Node.EventType.TOUCH_CANCEL, this.swallowOverlayTouch, this);
        }

        // 切场景销毁节点时，旧引用可能还没置空但已经不可用，所有事件解绑前都先走这里。
        ;

        _proto.canUseNode = function canUseNode(node) {
          return !!node && node.isValid;
        };
        _proto.safeOn = function safeOn(node, eventType, handler) {
          if (!this.canUseNode(node)) {
            return;
          }
          node.on(eventType, handler, this);
        };
        _proto.safeOff = function safeOff(node, eventType, handler) {
          if (!this.canUseNode(node)) {
            return;
          }
          node.off(eventType, handler, this);
        }

        // setSiblingIndex 只有在节点仍挂在父节点下时才安全，切场景销毁边界上必须先保护。
        ;

        _proto.bringNodeToTop = function bringNodeToTop(node) {
          var _node$parent;
          var parent = (_node$parent = node == null ? void 0 : node.parent) != null ? _node$parent : null;
          if (!this.canUseNode(node) || !(parent != null && parent.isValid)) {
            return;
          }
          node.setSiblingIndex(parent.children.length - 1);
        }

        // 回首页和销毁时统一停止暂停层动画，避免 tween 在节点销毁后继续访问内部 parent。
        ;

        _proto.stopPauseOverlayTweens = function stopPauseOverlayTweens() {
          this.stopNodeTreeTweens(this.node);
        };
        _proto.stopNodeTreeTweens = function stopNodeTreeTweens(node) {
          if (!this.canUseNode(node)) {
            return;
          }
          Tween.stopAllByTarget(node);
          var opacity = node.getComponent(UIOpacity);
          if (opacity) {
            Tween.stopAllByTarget(opacity);
          }
          for (var _i2 = 0, _arr = [].concat(node.children); _i2 < _arr.length; _i2++) {
            var child = _arr[_i2];
            this.stopNodeTreeTweens(child);
          }
        }

        // Mask 节点强制使用可显示的 SpriteFrame，避免空 SpriteFrame 导致蒙版完全不显示。
        ;

        _proto.ensurePauseOverlayMaskSprite = function ensurePauseOverlayMaskSprite() {
          var _this$hostNode;
          if (!this.pauseOverlayMask) {
            return;
          }
          var maskTransform = this.pauseOverlayMask.getComponent(UITransform);
          var maskSprite = this.pauseOverlayMask.getComponent(Sprite);
          if (!maskTransform || !maskSprite) {
            return;
          }
          var rootSprite = (_this$hostNode = this.hostNode) == null ? void 0 : _this$hostNode.getComponent(Sprite);
          if (!maskSprite.spriteFrame && rootSprite != null && rootSprite.spriteFrame) {
            // 复用 play 根节点已有的背景 SpriteFrame，确保蒙版一定有可渲染贴图。
            maskSprite.spriteFrame = rootSprite.spriteFrame;
          }
          maskSprite.enabled = true;
          maskSprite.sizeMode = Sprite.SizeMode.CUSTOM;
          maskSprite.type = Sprite.Type.SIMPLE;
          // 蒙版只需要统一压暗画面，因此固定使用半透明黑色。
          maskSprite.color = new Color(0, 0, 0, 170);
          maskTransform.setContentSize(maskTransform.width, maskTransform.height);
        }

        // 复用 Panel 中已搭好的音乐和音效节点，补上交互、存档和视觉状态。
        ;

        _proto.ensureAudioControls = function ensureAudioControls() {
          var _ref, _panel$getChildByName, _this$bgMusicControl$, _this$bgMusicControl, _this$bgMusicSlider$g, _this$bgMusicSlider, _this$bgMusicSlider$g2, _this$bgMusicSlider2, _this$bgMusicSlider$g3, _this$bgMusicSlider3, _panel$getChildByName2, _this$soundEffectCont, _this$soundEffectCont2, _this$soundEffectSlid, _this$soundEffectSlid2, _this$soundEffectSlid3, _this$soundEffectSlid4, _this$soundEffectSlid5, _this$soundEffectSlid6;
          var panel = this.pauseOverlayPanel;
          if (!panel) {
            return;
          }
          this.bgMusicControl = (_ref = (_panel$getChildByName = panel.getChildByName('BgSound')) != null ? _panel$getChildByName : panel.getChildByName('Music On')) != null ? _ref : null;
          this.bgMusicSlider = (_this$bgMusicControl$ = (_this$bgMusicControl = this.bgMusicControl) == null ? void 0 : _this$bgMusicControl.getChildByName('Slider')) != null ? _this$bgMusicControl$ : null;
          this.bgMusicSliderBase = (_this$bgMusicSlider$g = (_this$bgMusicSlider = this.bgMusicSlider) == null ? void 0 : _this$bgMusicSlider.getChildByName('SliderBase')) != null ? _this$bgMusicSlider$g : null;
          this.bgMusicFill = (_this$bgMusicSlider$g2 = (_this$bgMusicSlider2 = this.bgMusicSlider) == null ? void 0 : _this$bgMusicSlider2.getChildByName('Fill')) != null ? _this$bgMusicSlider$g2 : null;
          this.bgMusicController = (_this$bgMusicSlider$g3 = (_this$bgMusicSlider3 = this.bgMusicSlider) == null ? void 0 : _this$bgMusicSlider3.getChildByName('Controller')) != null ? _this$bgMusicSlider$g3 : null;
          this.soundEffectControl = (_panel$getChildByName2 = panel.getChildByName('Notifications')) != null ? _panel$getChildByName2 : null;
          this.soundEffectSlider = (_this$soundEffectCont = (_this$soundEffectCont2 = this.soundEffectControl) == null ? void 0 : _this$soundEffectCont2.getChildByName('Slider')) != null ? _this$soundEffectCont : null;
          this.soundEffectSliderBase = (_this$soundEffectSlid = (_this$soundEffectSlid2 = this.soundEffectSlider) == null ? void 0 : _this$soundEffectSlid2.getChildByName('SliderBase')) != null ? _this$soundEffectSlid : null;
          this.soundEffectFill = (_this$soundEffectSlid3 = (_this$soundEffectSlid4 = this.soundEffectSlider) == null ? void 0 : _this$soundEffectSlid4.getChildByName('Fill')) != null ? _this$soundEffectSlid3 : null;
          this.soundEffectController = (_this$soundEffectSlid5 = (_this$soundEffectSlid6 = this.soundEffectSlider) == null ? void 0 : _this$soundEffectSlid6.getChildByName('Controller')) != null ? _this$soundEffectSlid5 : null;
          this.loadAudioSettings();
          this.configureAudioControlLayout();
          this.bindAudioControlEvents();
          this.refreshAudioControls();
          this.applyAudioSettings();
        }

        // 读取本地保存的背景音乐和音效音量，保证玩家下次进入游戏时保持上次设置。
        ;

        _proto.loadAudioSettings = function loadAudioSettings() {
          var _sys$localStorage$get, _sys$localStorage$get2;
          var savedVolume = Number.parseFloat((_sys$localStorage$get = sys.localStorage.getItem(AUDIO_MUSIC_VOLUME_KEY)) != null ? _sys$localStorage$get : '1');
          if (Number.isFinite(savedVolume)) {
            this.bgMusicVolume = Math.max(0, Math.min(1, savedVolume));
          }
          var savedEffectVolume = Number.parseFloat((_sys$localStorage$get2 = sys.localStorage.getItem(AUDIO_SOUND_EFFECT_KEY)) != null ? _sys$localStorage$get2 : '1');
          if (Number.isFinite(savedEffectVolume)) {
            this.soundEffectVolume = Math.max(0, Math.min(1, savedEffectVolume));
          }
        }

        // 统一读取滑块底槽的左右边界，兼容不同锚点，避免每一条滑块都重复写一遍坐标换算。
        ;

        _proto.getSliderRange = function getSliderRange(baseNode) {
          var baseTransform = baseNode == null ? void 0 : baseNode.getComponent(UITransform);
          if (!baseNode || !baseTransform) {
            return null;
          }
          var minX = baseNode.position.x - baseTransform.width * baseTransform.anchorX;
          var maxX = minX + baseTransform.width;
          return {
            minX: minX,
            maxX: maxX,
            width: baseTransform.width
          };
        }

        // Fill 改用 Sprite 自带的横向填充，显示时只裁剪贴图，不再通过改宽度拉伸素材。
        ;

        _proto.prepareSliderFill = function prepareSliderFill(fillNode, fullWidth, minX) {
          var fillTransform = fillNode == null ? void 0 : fillNode.getComponent(UITransform);
          var fillSprite = fillNode == null ? void 0 : fillNode.getComponent(Sprite);
          if (!fillNode || !fillTransform || !fillSprite) {
            return;
          }
          fillSprite.type = Sprite.Type.FILLED;
          fillSprite.fillType = Sprite.FillType.HORIZONTAL;
          fillSprite.fillStart = 0;
          fillTransform.setContentSize(fullWidth, fillTransform.height);
          fillNode.setPosition(minX + fullWidth * fillTransform.anchorX, fillNode.position.y, fillNode.position.z);
        }

        // 一次性处理多个滑块相关节点的触摸绑定，减少重复代码，也避免漏绑或重复绑。
        ;

        _proto.bindSliderTouchEvents = function bindSliderTouchEvents(nodes, handler) {
          this.unbindSliderTouchEvents(nodes, handler);
          for (var _iterator3 = _createForOfIteratorHelperLoose(nodes), _step3; !(_step3 = _iterator3()).done;) {
            var node = _step3.value;
            if (!this.canUseNode(node)) {
              continue;
            }
            node.on(Node.EventType.TOUCH_START, handler, this);
            node.on(Node.EventType.TOUCH_MOVE, handler, this);
            node.on(Node.EventType.TOUCH_END, handler, this);
          }
        }

        // 销毁时统一解绑滑块触摸事件，避免界面关闭后残留回调。
        ;

        _proto.unbindSliderTouchEvents = function unbindSliderTouchEvents(nodes, handler) {
          for (var _iterator4 = _createForOfIteratorHelperLoose(nodes), _step4; !(_step4 = _iterator4()).done;) {
            var node = _step4.value;
            if (!this.canUseNode(node)) {
              continue;
            }
            node.off(Node.EventType.TOUCH_START, handler, this);
            node.off(Node.EventType.TOUCH_MOVE, handler, this);
            node.off(Node.EventType.TOUCH_END, handler, this);
          }
        }

        // 把触摸点按当前滑块的真实范围换算成 0 到 1 的数值，背景音乐和音效共用这套逻辑。
        ;

        _proto.updateSliderValueFromTouch = function updateSliderValueFromTouch(event, sliderNode, minX, maxX, setter) {
          var sliderTransform = sliderNode == null ? void 0 : sliderNode.getComponent(UITransform);
          if (!sliderNode || !sliderTransform) {
            return;
          }
          var uiLocation = event.getUILocation();
          var local = sliderTransform.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0));
          var rangeMinX = Math.min(minX, maxX);
          var rangeMaxX = Math.max(minX, maxX);
          var value = (local.x - rangeMinX) / Math.max(1, rangeMaxX - rangeMinX);
          setter(value);
        }

        // 刷新单条滑块的视觉，只更新 Fill 的填充比例和按钮位置，不再改变素材尺寸。
        ;

        _proto.refreshSliderVisual = function refreshSliderVisual(fillNode, controllerNode, minX, maxX, value) {
          var fillSprite = fillNode == null ? void 0 : fillNode.getComponent(Sprite);
          if (!fillNode || !controllerNode || !fillSprite) {
            return;
          }
          var rangeMinX = Math.min(minX, maxX);
          var rangeMaxX = Math.max(minX, maxX);
          var controllerX = rangeMinX + (rangeMaxX - rangeMinX) * value;
          // Fill 直接裁剪到当前比例，避免滑动时左侧图片被横向拉伸变形。
          fillSprite.fillRange = Math.max(0, Math.min(1, value));
          controllerNode.setPosition(controllerX, controllerNode.position.y, controllerNode.position.z);
        }

        // 音频控件的尺寸、图片和排版都以 scene 为准，这里只缓存交互所需的位置数据。
        ;

        _proto.configureAudioControlLayout = function configureAudioControlLayout() {
          var bgRange = this.getSliderRange(this.bgMusicSliderBase);
          if (bgRange) {
            this.bgMusicControllerMinX = bgRange.minX;
            this.bgMusicControllerMaxX = bgRange.maxX;
            this.prepareSliderFill(this.bgMusicFill, bgRange.width, bgRange.minX);
          }
          var soundRange = this.getSliderRange(this.soundEffectSliderBase);
          if (soundRange) {
            this.soundEffectControllerMinX = soundRange.minX;
            this.soundEffectControllerMaxX = soundRange.maxX;
            this.prepareSliderFill(this.soundEffectFill, soundRange.width, soundRange.minX);
          }
        }

        // 统一绑定背景音乐和音效滑块拖动事件，先解绑再绑定避免重复触发。
        ;

        _proto.bindAudioControlEvents = function bindAudioControlEvents() {
          this.bindSliderTouchEvents([this.bgMusicControl, this.bgMusicSlider, this.bgMusicController], this.onBgMusicControlTouch);
          this.bindSliderTouchEvents([this.soundEffectControl, this.soundEffectSlider, this.soundEffectController], this.onSoundEffectControlTouch);
        }

        // 根据当前设置刷新两条音量滑块的视觉状态。
        ;

        _proto.refreshAudioControls = function refreshAudioControls() {
          this.redrawBgMusicSlider();
          this.redrawSoundEffectSlider();
        }

        // 音量变化后立即刷新本地状态、视觉状态和真实音频源。
        ;

        _proto.setBgMusicVolume = function setBgMusicVolume(volume, persist) {
          if (persist === void 0) {
            persist = true;
          }
          this.bgMusicVolume = Math.max(0, Math.min(1, volume));
          if (persist) {
            sys.localStorage.setItem(AUDIO_MUSIC_VOLUME_KEY, this.bgMusicVolume.toString());
          }
          this.refreshAudioControls();
          this.applyAudioSettings();
        }

        // 音效音量变化后同步保存，并立即影响后续音效播放。
        ;

        _proto.setSoundEffectVolume = function setSoundEffectVolume(volume, persist) {
          if (persist === void 0) {
            persist = true;
          }
          this.soundEffectVolume = Math.max(0, Math.min(1, volume));
          if (persist) {
            sys.localStorage.setItem(AUDIO_SOUND_EFFECT_KEY, this.soundEffectVolume.toString());
          }
          this.refreshAudioControls();
          this.applyAudioSettings();
        }

        // 背景音乐滑块支持点击和拖动，直接把触摸点映射到 0 到 1 的音量范围。
        ;

        _proto.onBgMusicControlTouch = function onBgMusicControlTouch(event) {
          var _this3 = this;
          event.propagationStopped = true;
          this.updateSliderValueFromTouch(event, this.bgMusicSlider, this.bgMusicControllerMinX, this.bgMusicControllerMaxX, function (volume) {
            return _this3.setBgMusicVolume(volume);
          });
        }

        // 音效滑块支持点击和拖动，直接把触摸点映射到 0 到 1 的音量范围。
        ;

        _proto.onSoundEffectControlTouch = function onSoundEffectControlTouch(event) {
          var _this4 = this;
          event.propagationStopped = true;
          this.updateSliderValueFromTouch(event, this.soundEffectSlider, this.soundEffectControllerMinX, this.soundEffectControllerMaxX, function (volume) {
            return _this4.setSoundEffectVolume(volume);
          });
        }

        // 背景音乐滑块只复用 scene 中的 SliderBase、Fill 和 Controller 图片，不再自己绘制轨道。
        ;

        _proto.redrawBgMusicSlider = function redrawBgMusicSlider() {
          this.refreshSliderVisual(this.bgMusicFill, this.bgMusicController, this.bgMusicControllerMinX, this.bgMusicControllerMaxX, this.bgMusicVolume);
        }

        // 音效音量条和背景音乐保持同一套逻辑，同样只操作 Fill 的填充比例和 Controller 位置。
        ;

        _proto.redrawSoundEffectSlider = function redrawSoundEffectSlider() {
          this.refreshSliderVisual(this.soundEffectFill, this.soundEffectController, this.soundEffectControllerMinX, this.soundEffectControllerMaxX, this.soundEffectVolume);
        }

        // 如果场景后续挂了 AudioSource，这里会自动把 UI 设置同步到真实音频源。
        ;

        _proto.applyAudioSettings = function applyAudioSettings() {
          var _ref2, _this$hostNode2;
          var owner = (_ref2 = (_this$hostNode2 = this.hostNode) != null ? _this$hostNode2 : this.node.parent) != null ? _ref2 : this.node;
          var audioSources = owner.getComponentsInChildren(AudioSource);
          for (var _iterator5 = _createForOfIteratorHelperLoose(audioSources), _step5; !(_step5 = _iterator5()).done;) {
            var audioSource = _step5.value;
            var lowerName = audioSource.node.name.toLowerCase();
            if (lowerName.includes('bgm') || lowerName.includes('music')) {
              audioSource.volume = this.bgMusicVolume;
              continue;
            }
            if (lowerName.includes('sfx') || lowerName.includes('effect') || lowerName.includes('sound')) {
              audioSource.volume = this.soundEffectVolume;
            }
          }
        }

        // 读取 scene 中配置好的面板最终显示位置，后续打开弹窗都滑到这里。
        ;

        _proto.getPausePanelShownPosition = function getPausePanelShownPosition() {
          var _this$pauseOverlayPan, _this$pauseOverlayPan2;
          if (this.pausePanelShownPosition) {
            return this.pausePanelShownPosition.clone();
          }
          return (_this$pauseOverlayPan = (_this$pauseOverlayPan2 = this.pauseOverlayPanel) == null ? void 0 : _this$pauseOverlayPan2.position.clone()) != null ? _this$pauseOverlayPan : Vec3.ZERO.clone();
        }

        // 根据当前弹窗尺寸和面板宽度，动态计算完全滑出屏幕右侧后的隐藏位置。
        ;

        _proto.getPausePanelHiddenX = function getPausePanelHiddenX() {
          var _this$pauseOverlayPan3;
          var overlayTransform = this.node.getComponent(UITransform);
          var panelTransform = (_this$pauseOverlayPan3 = this.pauseOverlayPanel) == null ? void 0 : _this$pauseOverlayPan3.getComponent(UITransform);
          var shown = this.getPausePanelShownPosition();
          if (!overlayTransform || !panelTransform) {
            return shown.x;
          }
          var overlayHalfWidth = overlayTransform.width * 0.5;
          var panelHalfWidth = panelTransform.width * 0.5;
          return overlayHalfWidth + panelHalfWidth + PAUSE_PANEL_HIDDEN_GAP;
        }

        // 根据 paused 状态播放暂停弹窗动画：蒙版淡入淡出，面板从右侧滑入滑出。
        ;

        _proto.refreshPauseOverlay = function refreshPauseOverlay() {
          var _this$pauseOverlayMas,
            _maskNode$getComponen,
            _this5 = this;
          // 每次弹窗打开前都把暂停层提到最上面，避免被新生成的棋子或特效节点盖住。
          this.bringNodeToTop(this.node);
          var maskNode = (_this$pauseOverlayMas = this.pauseOverlayMask) != null ? _this$pauseOverlayMas : this.node;
          if (!this.canUseNode(maskNode)) {
            return;
          }
          var maskOpacity = (_maskNode$getComponen = maskNode.getComponent(UIOpacity)) != null ? _maskNode$getComponen : maskNode.addComponent(UIOpacity);
          Tween.stopAllByTarget(maskOpacity);
          if (this.pauseOverlayPanel) {
            Tween.stopAllByTarget(this.pauseOverlayPanel);
          }
          if (this.isPaused) {
            this.node.active = true;
            maskOpacity.opacity = 0;
            tween(maskOpacity).to(PAUSE_MASK_ANIM_DURATION, {
              opacity: 255
            }).start();
            if (this.pauseOverlayPanel) {
              var shown = this.getPausePanelShownPosition();
              this.pauseOverlayPanel.setPosition(this.getPausePanelHiddenX(), shown.y, shown.z);
              tween(this.pauseOverlayPanel).to(PAUSE_PANEL_ANIM_DURATION, {
                position: shown
              }, {
                easing: 'cubicOut'
              }).start();
            }
            return;
          }
          if (!this.node.active) {
            maskOpacity.opacity = 0;
            if (this.pauseOverlayPanel) {
              var _shown = this.getPausePanelShownPosition();
              this.pauseOverlayPanel.setPosition(this.getPausePanelHiddenX(), _shown.y, _shown.z);
            }
            return;
          }
          tween(maskOpacity).to(PAUSE_MASK_ANIM_DURATION, {
            opacity: 0
          }).start();
          if (this.pauseOverlayPanel) {
            var _shown2 = this.getPausePanelShownPosition();
            tween(this.pauseOverlayPanel).to(PAUSE_PANEL_ANIM_DURATION, {
              position: new Vec3(this.getPausePanelHiddenX(), _shown2.y, _shown2.z)
            }, {
              easing: 'cubicIn'
            }).call(function () {
              // 关闭动画结束后再隐藏整层，避免面板刚开始滑出时整层直接消失。
              if (!_this5.isPaused) {
                _this5.node.active = false;
              }
            }).start();
            return;
          }
          this.node.active = false;
        };
        return PauseOverlayController;
      }(Component), _descriptor = _applyDecoratedDescriptor(_class2.prototype, "closeButtonNode", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/PieceController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, SpriteFrame, Color, UITransform, Sprite, Label, ParticleSystem2D, Vec2, Component;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      SpriteFrame = module.SpriteFrame;
      Color = module.Color;
      UITransform = module.UITransform;
      Sprite = module.Sprite;
      Label = module.Label;
      ParticleSystem2D = module.ParticleSystem2D;
      Vec2 = module.Vec2;
      Component = module.Component;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2;
      cclegacy._RF.push({}, "107dfFHeExJCbgE9GnQ0EOZ", "PieceController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var DEFAULT_STYLE = {
        bodyColor: '#cf586d'
      };

      // 色阶沿用设计稿的暖色低级块、冷色中级块和深青色皇冠终局块。
      var PIECE_STYLE = {
        2: {
          bodyColor: '#f8ecdc'
        },
        4: {
          bodyColor: '#f7a536'
        },
        8: {
          bodyColor: '#ffc22e'
        },
        16: {
          bodyColor: '#9bc849'
        },
        32: {
          bodyColor: '#50ae61'
        },
        64: {
          bodyColor: '#35a1a5'
        },
        128: {
          bodyColor: '#3f88c7'
        },
        256: {
          bodyColor: '#5872c8'
        },
        512: {
          bodyColor: '#6e55b8'
        },
        1024: {
          bodyColor: '#8f54ad',
          textScale: 0.94
        },
        2048: {
          bodyColor: '#cf586d',
          textScale: 0.9
        },
        4096: {
          bodyColor: '#db5935',
          textScale: 0.9
        },
        8192: {
          bodyColor: '#2f6c78',
          textColor: '#ffe4a0',
          outlineColor: '#e8ad2d',
          decoration: 'crown',
          textScale: 0.86
        }
      };
      var PieceController = exports('PieceController', (_dec = ccclass('PieceController'), _dec2 = property({
        type: SpriteFrame,
        tooltip: '128 以上棋子使用的星点装饰'
      }), _dec3 = property({
        type: SpriteFrame,
        tooltip: '8192 及以上棋子使用的皇冠装饰'
      }), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(PieceController, _Component);
        function PieceController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "sparkleSpriteFrame", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "crownSpriteFrame", _descriptor2, _assertThisInitialized(_this));
          _this.value = 2;
          _this.shadowSprite = null;
          _this.bodySprite = null;
          _this.outlineSprite = null;
          _this.highlightSprite = null;
          _this.decorationSprite = null;
          _this.valueLabel = null;
          _this.valueTransform = null;
          _this.particleSystem = null;
          _this.currentBgColor = new Color(248, 236, 220, 255);
          _this.currentTextColor = new Color(61, 43, 36, 255);
          _this.lastLayoutWidth = 0;
          _this.lastLayoutHeight = 0;
          _this.lastTrailColorValue = -1;
          return _this;
        }
        var _proto = PieceController.prototype;
        _proto.onLoad = function onLoad() {
          this.resolveViewNodes();
          this.configureView();
          this.refreshView();
          this.syncLayout(true);
        };
        _proto.getValue = function getValue() {
          return this.value;
        }

        /** 数值是棋子表现的唯一入口，颜色、文字、装饰和拖尾在同一帧完成刷新。 */;
        _proto.setValue = function setValue(value) {
          this.value = value;
          this.refreshView();
          this.syncLayout(true);
        }

        /**
         * 根据根节点实时尺寸同步所有可见图层。
         * PlayController 会先改变根 UITransform，再调用本方法，因此不能依赖 Prefab 的 120 像素初始值。
         */;
        _proto.syncLayout = function syncLayout(force) {
          var _rootTransform$conten, _rootTransform$conten2;
          if (force === void 0) {
            force = false;
          }
          var rootTransform = this.node.getComponent(UITransform);
          var width = (_rootTransform$conten = rootTransform == null ? void 0 : rootTransform.contentSize.width) != null ? _rootTransform$conten : 120;
          var height = (_rootTransform$conten2 = rootTransform == null ? void 0 : rootTransform.contentSize.height) != null ? _rootTransform$conten2 : width;
          if (!force && this.lastLayoutWidth === width && this.lastLayoutHeight === height) {
            return;
          }
          this.lastLayoutWidth = width;
          this.lastLayoutHeight = height;
          this.resizeSpriteNode(this.shadowSprite, width * 1.06, height * 1.06, 0, -height * 0.025);
          this.resizeSpriteNode(this.bodySprite, width, height);
          this.resizeSpriteNode(this.outlineSprite, width, height);
          this.resizeSpriteNode(this.highlightSprite, width, height);
          this.resizeSpriteNode(this.decorationSprite, width, height);
          this.refreshValueLayout(width, height);
          this.syncTrailLayout(width, height, true);
        }

        // 兼容旧调用点：拖尾尺寸同步现在会连同整颗棋子的分层布局一起刷新。
        ;

        _proto.syncTrailEffect = function syncTrailEffect(force) {
          if (force === void 0) {
            force = false;
          }
          this.syncLayout(force);
        };
        _proto.stopParticle = function stopParticle() {
          if (!this.particleSystem) {
            return;
          }
          this.particleSystem.resetSystem();
          this.particleSystem.stopSystem();
        }

        // 技能碎片和合并临时棋子只复制主体图，不复制数字、描边和皇冠。
        ;

        _proto.getSpriteFrame = function getSpriteFrame() {
          var _this$bodySprite$spri, _this$bodySprite;
          return (_this$bodySprite$spri = (_this$bodySprite = this.bodySprite) == null ? void 0 : _this$bodySprite.spriteFrame) != null ? _this$bodySprite$spri : null;
        };
        _proto.getBackgroundColor = function getBackgroundColor() {
          return this.currentBgColor.clone();
        };
        _proto.getTextColor = function getTextColor() {
          return this.currentTextColor.clone();
        };
        _proto.resolveViewNodes = function resolveViewNodes() {
          var _this$node$getChildBy, _this$node$getChildBy2, _this$node$getChildBy3, _this$node$getChildBy4, _this$node$getChildBy5, _this$node$getChildBy6, _this$node$getChildBy7, _this$node$getChildBy8, _this$node$getChildBy9, _this$node$getChildBy10, _valueNode$getCompone, _valueNode$getCompone2, _this$node$getChildBy11, _this$node$getChildBy12;
          this.shadowSprite = (_this$node$getChildBy = (_this$node$getChildBy2 = this.node.getChildByName('Shadow')) == null ? void 0 : _this$node$getChildBy2.getComponent(Sprite)) != null ? _this$node$getChildBy : null;
          this.bodySprite = (_this$node$getChildBy3 = (_this$node$getChildBy4 = this.node.getChildByName('Body')) == null ? void 0 : _this$node$getChildBy4.getComponent(Sprite)) != null ? _this$node$getChildBy3 : null;
          this.outlineSprite = (_this$node$getChildBy5 = (_this$node$getChildBy6 = this.node.getChildByName('Outline')) == null ? void 0 : _this$node$getChildBy6.getComponent(Sprite)) != null ? _this$node$getChildBy5 : null;
          this.highlightSprite = (_this$node$getChildBy7 = (_this$node$getChildBy8 = this.node.getChildByName('Highlight')) == null ? void 0 : _this$node$getChildBy8.getComponent(Sprite)) != null ? _this$node$getChildBy7 : null;
          this.decorationSprite = (_this$node$getChildBy9 = (_this$node$getChildBy10 = this.node.getChildByName('Decoration')) == null ? void 0 : _this$node$getChildBy10.getComponent(Sprite)) != null ? _this$node$getChildBy9 : null;
          var valueNode = this.node.getChildByName('Value');
          this.valueLabel = (_valueNode$getCompone = valueNode == null ? void 0 : valueNode.getComponent(Label)) != null ? _valueNode$getCompone : null;
          this.valueTransform = (_valueNode$getCompone2 = valueNode == null ? void 0 : valueNode.getComponent(UITransform)) != null ? _valueNode$getCompone2 : null;
          this.particleSystem = (_this$node$getChildBy11 = (_this$node$getChildBy12 = this.node.getChildByName('TrailEmitter')) == null ? void 0 : _this$node$getChildBy12.getComponent(ParticleSystem2D)) != null ? _this$node$getChildBy11 : null;
        };
        _proto.configureView = function configureView() {
          var sprites = [this.shadowSprite, this.bodySprite, this.outlineSprite, this.highlightSprite, this.decorationSprite];
          for (var _i = 0, _sprites = sprites; _i < _sprites.length; _i++) {
            var sprite = _sprites[_i];
            if (!sprite) {
              continue;
            }
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            // 保留 160x160 原始透明画布坐标，星点和皇冠才不会被自动裁边后放大到整颗棋子。
            sprite.trim = false;
          }
          if (this.shadowSprite) {
            this.shadowSprite.color = new Color(255, 255, 255, 150);
          }
          if (this.highlightSprite) {
            this.highlightSprite.color = new Color(255, 255, 255, 125);
          }
          if (this.valueLabel) {
            this.valueLabel.isBold = false;
            this.valueLabel.enableShadow = false;
            this.valueLabel.enableOutline = true;
          }
          if (this.particleSystem) {
            // 游戏页改用固定橙色虚线落子指引，不再用高光粒子拖尾干扰手绘风格。
            this.particleSystem.stopSystem();
            this.particleSystem.node.active = false;
          }
        };
        _proto.refreshView = function refreshView() {
          var _PIECE_STYLE$this$val, _style$textColor, _style$decoration;
          var style = (_PIECE_STYLE$this$val = PIECE_STYLE[this.value]) != null ? _PIECE_STYLE$this$val : DEFAULT_STYLE;
          this.currentBgColor = this.fromHex(style.bodyColor);
          this.currentTextColor = this.fromHex((_style$textColor = style.textColor) != null ? _style$textColor : '#fff9ea');
          if (this.bodySprite) {
            this.bodySprite.color = this.currentBgColor;
          }
          if (this.outlineSprite) {
            var _style$outlineColor;
            this.outlineSprite.color = this.fromHex((_style$outlineColor = style.outlineColor) != null ? _style$outlineColor : '#4b3528');
          }
          this.refreshDecoration((_style$decoration = style.decoration) != null ? _style$decoration : 'none');
          this.refreshValueLabel(style);
          this.lastTrailColorValue = -1;
        };
        _proto.refreshDecoration = function refreshDecoration(decoration) {
          var sprite = this.decorationSprite;
          if (!sprite) {
            return;
          }
          if (decoration === 'none') {
            sprite.node.active = false;
            return;
          }
          sprite.node.active = true;
          sprite.spriteFrame = decoration === 'crown' ? this.crownSpriteFrame : this.sparkleSpriteFrame;
          sprite.enabled = !!sprite.spriteFrame;
        };
        _proto.refreshValueLabel = function refreshValueLabel(style) {
          var _style$textColor2;
          if (!this.valueLabel) {
            return;
          }
          this.valueLabel.string = "" + this.value;
          this.valueLabel.color = this.currentTextColor;
          var usesDarkText = ((_style$textColor2 = style.textColor) != null ? _style$textColor2 : '').toLowerCase() === '#3d2b24';
          this.valueLabel.outlineColor = usesDarkText ? new Color(255, 249, 234, 235) : new Color(74, 49, 37, 235);
          this.valueLabel.outlineWidth = 2;
        };
        _proto.refreshValueLayout = function refreshValueLayout(width, height) {
          var _PIECE_STYLE$this$val2, _style$textScale, _this$valueTransform;
          if (!this.valueLabel) {
            return;
          }
          var digits = ("" + this.value).length;
          var style = (_PIECE_STYLE$this$val2 = PIECE_STYLE[this.value]) != null ? _PIECE_STYLE$this$val2 : DEFAULT_STYLE;
          var scale = Math.min(width, height) / 120;
          var baseFontSize = digits >= 5 ? 32 : digits === 4 ? 37 : digits === 3 ? 46 : 56;
          var decorationOffset = style.decoration === 'crown' ? -height * 0.08 : 0;
          this.valueLabel.node.setPosition(0, decorationOffset, 0);
          this.valueLabel.fontSize = Math.max(18, Math.round(baseFontSize * scale * ((_style$textScale = style.textScale) != null ? _style$textScale : 1)));
          this.valueLabel.lineHeight = this.valueLabel.fontSize;
          this.valueLabel.spacingX = Math.round((digits >= 5 ? -5 : digits === 4 ? -4 : digits === 3 ? -2 : 0) * scale);
          this.valueLabel.outlineWidth = Math.max(1, Math.round(2 * scale));
          (_this$valueTransform = this.valueTransform) == null || _this$valueTransform.setContentSize(width * 0.92, height * 0.72);
        };
        _proto.resizeSpriteNode = function resizeSpriteNode(sprite, width, height, x, y) {
          var _sprite$node$getCompo;
          if (x === void 0) {
            x = 0;
          }
          if (y === void 0) {
            y = 0;
          }
          if (!sprite) {
            return;
          }
          var transform = (_sprite$node$getCompo = sprite.node.getComponent(UITransform)) != null ? _sprite$node$getCompo : sprite.node.addComponent(UITransform);
          transform.setContentSize(width, height);
          sprite.node.setPosition(x, y, 0);
        };
        _proto.syncTrailLayout = function syncTrailLayout(width, height, force) {
          var _emitterNode$getCompo;
          if (!this.particleSystem) {
            return;
          }
          var emitterNode = this.particleSystem.node;
          var emitterTransform = (_emitterNode$getCompo = emitterNode.getComponent(UITransform)) != null ? _emitterNode$getCompo : emitterNode.addComponent(UITransform);
          emitterNode.setSiblingIndex(0);
          emitterNode.setPosition(0, height * 0.46, 0);
          emitterTransform.setContentSize(width, Math.max(24, height * 0.3));
          var particle = this.particleSystem;
          particle.sourcePos = new Vec2(0, 0);
          particle.posVar = new Vec2(width * 0.5, height * 0.04);
          particle.startSize = Math.max(30, width * 0.3);
          particle.startSizeVar = Math.max(4, width * 0.08);
          particle.endSize = Math.max(6, width * 0.06);
          particle.endSizeVar = Math.max(2, width * 0.03);
          particle.life = 0.38;
          particle.lifeVar = 0.08;
          particle.speed = Math.max(110, height);
          particle.speedVar = Math.max(32, height * 0.3);
          particle.angle = 90;
          particle.angleVar = 12;
          particle.emissionRate = 260;
          particle.totalParticles = 56;
          particle._totalParticles = 56;
          particle.positionType = 0;
          if (force || this.lastTrailColorValue !== this.value) {
            this.lastTrailColorValue = this.value;
            this.syncTrailColor(particle, 220, 55);
          }
        };
        _proto.syncTrailColor = function syncTrailColor(particle, startAlpha, endAlpha) {
          var baseColor = this.currentBgColor;
          var startColor = new Color(Math.round(baseColor.r * 0.92), Math.round(baseColor.g * 0.92), Math.round(baseColor.b * 0.92), startAlpha);
          var endColor = new Color(Math.round(baseColor.r + (255 - baseColor.r) * 0.45), Math.round(baseColor.g + (255 - baseColor.g) * 0.45), Math.round(baseColor.b + (255 - baseColor.b) * 0.45), endAlpha);
          particle.startColor = startColor;
          particle.endColor = endColor;
          particle.startColorVar = new Color(14, 14, 14, 10);
          particle.endColorVar = new Color(8, 8, 8, 6);
          particle._startColor = startColor;
          particle._endColor = endColor;
          particle._startColorVar = particle.startColorVar;
          particle._endColorVar = particle.endColorVar;
        };
        _proto.fromHex = function fromHex(hex) {
          var color = new Color();
          Color.fromHEX(color, hex);
          return color;
        };
        return PieceController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "sparkleSpriteFrame", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "crownSpriteFrame", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/PlayController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './PieceController.ts', './PlayUIController.ts', './GameAudioManager.ts', './GameShareAdapter.ts', './GameFeedbackAdapter.ts', './PlayerEconomyStore.ts', './BoardGeometry.ts', './ScoreManager.ts', './BoardModel.ts', './TransientFxRegistry.ts'], function (exports) {
  var _applyDecoratedDescriptor, _initializerDefineProperty, _inheritsLoose, _assertThisInitialized, _extends, _asyncToGenerator, _regeneratorRuntime, _createForOfIteratorHelperLoose, cclegacy, _decorator, AudioClip, Prefab, SpriteFrame, director, Node, instantiate, UITransform, Vec3, Tween, tween, Sprite, Color, UIOpacity, Component, PieceController, PlayUIController, GameAudioManager, GameShareAdapter, GameFeedbackAdapter, PlayerEconomyStore, BoardGeometry, ScoreManager, BoardModel, TransientFxRegistry;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _initializerDefineProperty = module.initializerDefineProperty;
      _inheritsLoose = module.inheritsLoose;
      _assertThisInitialized = module.assertThisInitialized;
      _extends = module.extends;
      _asyncToGenerator = module.asyncToGenerator;
      _regeneratorRuntime = module.regeneratorRuntime;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      AudioClip = module.AudioClip;
      Prefab = module.Prefab;
      SpriteFrame = module.SpriteFrame;
      director = module.director;
      Node = module.Node;
      instantiate = module.instantiate;
      UITransform = module.UITransform;
      Vec3 = module.Vec3;
      Tween = module.Tween;
      tween = module.tween;
      Sprite = module.Sprite;
      Color = module.Color;
      UIOpacity = module.UIOpacity;
      Component = module.Component;
    }, function (module) {
      PieceController = module.PieceController;
    }, function (module) {
      PlayUIController = module.PlayUIController;
    }, function (module) {
      GameAudioManager = module.GameAudioManager;
    }, function (module) {
      GameShareAdapter = module.GameShareAdapter;
    }, function (module) {
      GameFeedbackAdapter = module.GameFeedbackAdapter;
    }, function (module) {
      PlayerEconomyStore = module.PlayerEconomyStore;
    }, function (module) {
      BoardGeometry = module.BoardGeometry;
    }, function (module) {
      ScoreManager = module.ScoreManager;
    }, function (module) {
      BoardModel = module.BoardModel;
    }, function (module) {
      TransientFxRegistry = module.TransientFxRegistry;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _dec4, _dec5, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _dec14, _dec15, _dec16, _dec17, _dec18, _dec19, _dec20, _dec21, _dec22, _dec23, _dec24, _dec25, _dec26, _dec27, _dec28, _dec29, _dec30, _class4, _class5, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _descriptor13, _descriptor14, _descriptor15, _descriptor16, _descriptor17, _descriptor18, _descriptor19, _descriptor20, _descriptor21, _descriptor22, _descriptor23, _descriptor24, _descriptor25, _descriptor26, _descriptor27, _descriptor28;
      cclegacy._RF.push({}, "fb23bCRN9pK3aMz5OXGm9Sg", "PlayController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;

      // 统一描述棋盘中的格子坐标，row 从下往上增长，column 从左往右增长。

      // 表示一次可执行的合并组，anchor 是保留下来的棋子，其余成员会在原位置消除。

      // 定向合并的结果，anchor 表示合并后继续参与后续连锁的棋子。

      /**
       * 首页与玩法场景之间只传递纯数据快照，不让首页直接持有棋盘节点。
       * 模块状态会在 director.loadScene 切场景时保留，结束游戏后统一清空。
       */
      var OngoingGameSession = exports('OngoingGameSession', {
        active: false,
        snapshot: null,
        hasActiveGame: function hasActiveGame() {
          return this.active;
        },
        beginNewGame: function beginNewGame() {
          this.active = true;
          this.snapshot = null;
        },
        save: function save(snapshot) {
          this.active = true;
          this.snapshot = snapshot;
        },
        consumeSnapshot: function consumeSnapshot() {
          var snapshot = this.snapshot;
          this.snapshot = null;
          return snapshot;
        },
        finishGame: function finishGame() {
          this.active = false;
          this.snapshot = null;
        }
      });

      // 交换技能拖拽时需要记录起点和原始表现，方便无效释放时回到原位。

      // 控制同屏特效节点上限，避免频繁创建粒子导致卡顿。
      var MAX_ACTIVE_FX = 18;
      // 连续消除音效之间保留最小听感间隔，避免连锁时音效糊成一片。
      var MERGE_SOUND_MIN_INTERVAL = 0.46;
      // 单局金币结算参数集中在玩法层，方便后续按关卡、活动或难度做倍率扩展。
      var GAME_OVER_SCORE_COIN_DIVISOR = 120;
      var GAME_OVER_HIGHEST_BASE_POWER = 7;
      var GAME_OVER_HIGHEST_POWER_COIN = 8;
      var GAME_OVER_MIN_COIN_REWARD = 5;
      var GAME_OVER_MAX_COIN_REWARD = 300;
      var PlaySoundEffectClips = exports('PlaySoundEffectClips', (_dec = ccclass('PlaySoundEffectClips'), _dec2 = property({
        type: AudioClip,
        tooltip: 'Hammer skill sound effect'
      }), _dec3 = property({
        type: AudioClip,
        tooltip: 'Bomb skill sound effect'
      }), _dec4 = property({
        type: AudioClip,
        tooltip: 'Swap skill success sound effect'
      }), _dec5 = property({
        type: AudioClip,
        tooltip: 'Game over sound effect'
      }), _dec(_class = (_class2 = function PlaySoundEffectClips() {
        // 锤子技能成功敲碎棋子时播放的短音效。
        _initializerDefineProperty(this, "hammerSkillAudioClip", _descriptor, this);
        // 炸弹技能成功引爆时播放的短音效。
        _initializerDefineProperty(this, "bombSkillAudioClip", _descriptor2, this);
        // 交换技能成功形成合并时播放的短音效。
        _initializerDefineProperty(this, "swapSkillAudioClip", _descriptor3, this);
        // 游戏进入结算结束状态时播放的短音效。
        _initializerDefineProperty(this, "gameOverAudioClip", _descriptor4, this);
      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "hammerSkillAudioClip", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "bombSkillAudioClip", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "swapSkillAudioClip", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "gameOverAudioClip", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));
      var PlayController = exports('PlayController', (_dec6 = ccclass('PlayController'), _dec7 = property({
        tooltip: 'Board columns'
      }), _dec8 = property({
        tooltip: 'Board rows'
      }), _dec9 = property({
        type: Prefab,
        tooltip: 'Piece prefab'
      }), _dec10 = property({
        type: SpriteFrame,
        tooltip: 'Hammer skill sprite frame'
      }), _dec11 = property({
        type: SpriteFrame,
        tooltip: 'Bomb skill sprite frame'
      }), _dec12 = property({
        type: SpriteFrame,
        tooltip: 'Game over popup sprite frame'
      }), _dec13 = property({
        type: SpriteFrame,
        tooltip: 'Game over replay button sprite frame'
      }), _dec14 = property({
        type: SpriteFrame,
        tooltip: 'Game over home button sprite frame'
      }), _dec15 = property({
        type: SpriteFrame,
        tooltip: 'Game over share button sprite frame'
      }), _dec16 = property({
        type: AudioClip,
        tooltip: 'Piece collision sound effect'
      }), _dec17 = property({
        type: AudioClip,
        tooltip: 'Landing merge sound effect'
      }), _dec18 = property({
        type: AudioClip,
        tooltip: 'Swap rollback sound effect'
      }), _dec19 = property({
        type: PlaySoundEffectClips,
        tooltip: 'Gameplay sound effect clips'
      }), _dec20 = property({
        type: AudioClip,
        tooltip: 'Gameplay background music'
      }), _dec21 = property({
        type: Prefab,
        tooltip: 'Gameplay coin bar prefab'
      }), _dec22 = property({
        tooltip: 'Home scene name'
      }), _dec23 = property({
        tooltip: 'Cell spacing'
      }), _dec24 = property({
        tooltip: 'Bottom-left cell center X'
      }), _dec25 = property({
        tooltip: 'Bottom-left cell center Y'
      }), _dec26 = property({
        tooltip: 'Piece size'
      }), _dec27 = property({
        tooltip: 'Normal fall speed'
      }), _dec28 = property({
        tooltip: 'Fast fall speed'
      }), _dec29 = property({
        tooltip: 'Spawn offset above board'
      }), _dec30 = property({
        type: [SpriteFrame],
        tooltip: '技能计数数字贴图'
      }), _dec6(_class4 = (_class5 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(PlayController, _Component);
        function PlayController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          // 棋盘列数，当前玩法固定为 5 列。
          _initializerDefineProperty(_this, "boardwidth", _descriptor5, _assertThisInitialized(_this));
          // 棋盘行数，当前玩法固定为 7 行。
          _initializerDefineProperty(_this, "boardheight", _descriptor6, _assertThisInitialized(_this));
          // 棋子预制体，运行时会从这里实例化新的下落棋子。
          _initializerDefineProperty(_this, "basePieceController", _descriptor7, _assertThisInitialized(_this));
          // 锤子技能使用的贴图，场景里绑定 assets/images/Skills/Hammer.png 的 SpriteFrame。
          _initializerDefineProperty(_this, "hammerSkillSpriteFrame", _descriptor8, _assertThisInitialized(_this));
          // 炸弹技能使用的贴图，场景里绑定 assets/images/Skills/Bomb.png 的 SpriteFrame。
          _initializerDefineProperty(_this, "bombSkillSpriteFrame", _descriptor9, _assertThisInitialized(_this));
          // 游戏结束弹窗直接复用项目中的活页面板素材，避免运行时 Graphics 风格脱节。
          _initializerDefineProperty(_this, "gameOverPopupSpriteFrame", _descriptor10, _assertThisInitialized(_this));
          // 游戏结束重玩入口复用项目现有 Repeat icon。
          _initializerDefineProperty(_this, "gameOverReplayButtonSpriteFrame", _descriptor11, _assertThisInitialized(_this));
          // 游戏结束回首页入口复用项目现有 Home icon。
          _initializerDefineProperty(_this, "gameOverHomeButtonSpriteFrame", _descriptor12, _assertThisInitialized(_this));
          // 游戏结束分享入口复用项目现有 Share icon。
          _initializerDefineProperty(_this, "gameOverShareButtonSpriteFrame", _descriptor13, _assertThisInitialized(_this));
          // 棋子落地触碰时播放的音效。
          _initializerDefineProperty(_this, "collisionAudioClip", _descriptor14, _assertThisInitialized(_this));
          // 棋子落地后直接触发消除时播放的音效。
          _initializerDefineProperty(_this, "landingMergeAudioClip", _descriptor15, _assertThisInitialized(_this));
          // 交换后无法形成消除时，回退动画播放的提示音。
          _initializerDefineProperty(_this, "swapRollbackAudioClip", _descriptor16, _assertThisInitialized(_this));
          // 玩法短音效合集，便于在 Creator 面板里集中拖入技能、结算等反馈音。
          _initializerDefineProperty(_this, "soundEffectClips", _descriptor17, _assertThisInitialized(_this));
          // 游戏场景循环播放的背景音乐。
          _initializerDefineProperty(_this, "gameplayBgmClip", _descriptor18, _assertThisInitialized(_this));
          // 游戏场景顶部金币条，和首页体力条使用同一位置及缩放。
          _initializerDefineProperty(_this, "coinBarPrefab", _descriptor19, _assertThisInitialized(_this));
          // 暂停弹窗点击回首页时加载的首页场景名，默认对应 assets/scence/home.scene。
          _initializerDefineProperty(_this, "homeSceneName", _descriptor20, _assertThisInitialized(_this));
          // 单元格之间的额外间距，步长 = 棋子尺寸 + 间距。
          _initializerDefineProperty(_this, "spacing", _descriptor21, _assertThisInitialized(_this));
          // 旧版手动配置的棋盘原点，当前主要作为序列化兼容字段保留。
          _initializerDefineProperty(_this, "x", _descriptor22, _assertThisInitialized(_this));
          // 旧版手动配置的棋盘原点，当前主要作为序列化兼容字段保留。
          _initializerDefineProperty(_this, "y", _descriptor23, _assertThisInitialized(_this));
          // 棋子显示尺寸，生成棋子和特效时都会同步使用这个尺寸。
          _initializerDefineProperty(_this, "pieceSize", _descriptor24, _assertThisInitialized(_this));
          // 普通下落速度。
          _initializerDefineProperty(_this, "fallSpeed", _descriptor25, _assertThisInitialized(_this));
          // 快速下落速度，按下时切换到这个速度。
          _initializerDefineProperty(_this, "fastFallSpeed", _descriptor26, _assertThisInitialized(_this));
          // 新棋子出生在棋盘顶部之外的偏移量，给玩家留出观察和拖动时间。
          _initializerDefineProperty(_this, "spawnOffsetY", _descriptor27, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "counterNumberSpriteFrames", _descriptor28, _assertThisInitialized(_this));
          // 可直接随机生成的初始数字池，超过 128 的数字只能通过合成得到。
          _this.basePieceList = [2, 4, 8, 16, 32, 64, 128];
          // 二维数组表示棋盘状态，board[row][column] 为空时用 null 表示。
          _this.board = [];
          // 当前正在下落的棋子；当它落地并结算后，这里会被清空。
          _this.currentPiece = null;
          // 当前下落棋子的目标列。
          _this.currentColumn = 0;
          // 下一枚棋子预先抽取，仅用于设计稿的左侧预览卡。
          _this.nextPieceValue = 2;
          // 是否处于按住后的快速下落状态。
          _this.isFastDropping = false;
          // 游戏结束标记；当前由结算弹窗接管重玩入口，根节点触摸重开只作为兜底。
          _this.isGameOver = false;
          // 是否正在执行合并、重力结算等异步流程；期间禁止再次操作。
          _this.isResolving = false;
          // 暂停标记，暂停时 update 不再推动棋子下落。
          _this.isPaused = false;
          // 交换技能激活时只冻结玩法，不触发真正暂停弹窗。
          _this.isSwapSkillActive = false;
          // 锤子技能激活时同样只冻结玩法，等待玩家点选一个棋盘内棋子敲碎。
          _this.isHammerSkillActive = false;
          // 炸弹技能激活时冻结玩法，等待玩家点选中心棋子并炸掉九宫格范围。
          _this.isBombSkillActive = false;
          // 当前正在被拖拽的棋子信息，释放后用于判断是否可以交换。
          _this.swapDragState = null;
          // 技能库存和金币来自跨场景经济仓库，重开或返回首页都不会重置玩家资产。
          _this.economy = PlayerEconomyStore.getInstance();
          // 棋盘坐标和分数规则都交给独立模块，PlayController 保留对局流程调度。
          _this.boardModel = new BoardModel();
          _this.boardGeometry = null;
          _this.scoreManager = new ScoreManager();
          // UI 渲染组件，专门负责棋盘绘制、状态栏、控制栏和暂停遮罩。
          _this.uiController = null;
          // 棋子和临时特效使用独立层级，避免运行时追加节点盖住暂停/结算覆盖层。
          _this.pieceLayer = null;
          _this.fxLayer = null;
          // 首页已经拆到独立 home.scene；玩法场景加载后直接进入一局。
          _this.hasStartedSession = true;
          // 拖尾生成计时器，用来控制特效频率。
          _this.trailTimer = 0;
          // 当前屏幕上仍未销毁的特效节点交给注册表统一管理，便于重开和回首页收口。
          _this.transientFx = new TransientFxRegistry(MAX_ACTIVE_FX);
          // 音频和分享适配从玩法主流程中拆出，降低 PlayController 的横向职责。
          _this.audioManager = null;
          _this.shareAdapter = new GameShareAdapter();
          _this.feedbackAdapter = new GameFeedbackAdapter();
          // 记录最近一次合并音效时间，用来给连续消除留出可感知的停顿。
          _this.lastMergeSoundTimeMs = -Infinity;
          // 本局结束时发放的金币数，只用于结算弹窗展示，重开或回首页后清零。
          _this.gameOverCoinReward = 0;
          // 每局每种技能最多成功使用一次；库存可以大于 1，但本局按钮会在使用后置灰。
          _this.usedSkillsThisGame = _this.createEmptySkillUsageState();
          return _this;
        }
        var _proto = PlayController.prototype;
        // 生命周期入口：先准备棋盘数据，再把界面初始化交给独立的 UI 组件。
        _proto.onLoad = function onLoad() {
          var _this$getComponent,
            _this2 = this;
          // 750×1334 游戏页中出生棋子紧贴棋盘上方，避免和顶部目标卡重叠。
          this.spawnOffsetY = 0;
          var ongoingSnapshot = OngoingGameSession.consumeSnapshot();
          if (!OngoingGameSession.hasActiveGame()) {
            // 兼容 Creator 直接预览 game.scene 的开发入口。
            OngoingGameSession.beginNewGame();
          }
          this.resetBoard();
          this.ensureGameplayLayers();
          this.boardGeometry = new BoardGeometry(this.node, this.buildBoardGeometryOptions());
          this.audioManager = new GameAudioManager(this.node);
          this.audioManager.setup();
          this.uiController = (_this$getComponent = this.getComponent(PlayUIController)) != null ? _this$getComponent : this.addComponent(PlayUIController);
          // UI 组件只接收绘制所需参数和按钮回调，不参与玩法计算。
          this.uiController.setup({
            layout: {
              boardwidth: this.boardwidth,
              boardheight: this.boardheight,
              pieceSize: this.pieceSize,
              spacing: this.spacing
            },
            actions: {
              pause: function pause() {
                return _this2.togglePauseFromUi();
              },
              restart: function restart() {
                void _this2.restartGame();
              },
              homeFromPause: function homeFromPause() {
                return _this2.returnToStartPageFromPause();
              },
              shareFromPause: function shareFromPause() {
                void _this2.shareGameFromPause();
              },
              feedbackFromPause: function feedbackFromPause() {
                void _this2.openFeedbackFromPause();
              },
              useBomb: function useBomb() {
                return _this2.toggleBombSkillFromUi();
              },
              useHammer: function useHammer() {
                return _this2.toggleHammerSkillFromUi();
              },
              useSwap: function useSwap() {
                return _this2.toggleSwapSkillFromUi();
              },
              homeFromGameOver: function homeFromGameOver() {
                return _this2.returnToStartPageFromGameOver();
              },
              shareFromGameOver: function shareFromGameOver() {
                void _this2.shareGameFromGameOver();
              },
              coinRewardShare: function coinRewardShare() {
                void _this2.shareForCoinReward();
              }
            },
            resources: {
              coinBarPrefab: this.coinBarPrefab,
              counterNumberSpriteFrames: this.counterNumberSpriteFrames,
              gameOverPopupSpriteFrame: this.gameOverPopupSpriteFrame,
              gameOverReplayButtonSpriteFrame: this.gameOverReplayButtonSpriteFrame,
              gameOverHomeButtonSpriteFrame: this.gameOverHomeButtonSpriteFrame,
              gameOverShareButtonSpriteFrame: this.gameOverShareButtonSpriteFrame
            }
          });
          if (ongoingSnapshot) {
            this.restoreOngoingGame(ongoingSnapshot);
          }
          this.bindInput();
        }
        // 等场景节点初始化完成后再生成第一颗棋子，避免引用未准备好的节点。
        ;

        _proto.start = function start() {
          var _this$uiController, _this$audioManager;
          // 某些平台会在启动后一帧才拿到稳定的安全区，这里让 UI 组件再补一次布局。
          (_this$uiController = this.uiController) == null || _this$uiController.syncLayout();
          (_this$audioManager = this.audioManager) == null || _this$audioManager.playGameplayBackgroundMusic(this.gameplayBgmClip);
          this.refreshUiState();
          if (!this.currentPiece && !this.isGameOver) {
            this.spawnPiece();
          }
          // 玩法期间提前预加载首页，减少暂停返回首页时的场景切换等待。
          director.preloadScene(this.homeSceneName);
        };
        _proto.onDestroy = function onDestroy() {
          this.node.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
          this.node.off(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this);
          this.node.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
          this.node.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
          this.uiController = null;
          this.pieceLayer = null;
          this.fxLayer = null;
        }

        /**
         * 解析 Scene 中固定的 PieceLayer/FxLayer；旧场景缺少节点时才创建兼容层。
         *
         * 两层都保持与 Main 相同的局部坐标系：棋盘逻辑无需改坐标换算，
         * 但新生成的棋子和动画不会再因为 append 到 Main 末尾而压住 OverlayLayer。
         */;
        _proto.ensureGameplayLayers = function ensureGameplayLayers() {
          var _this$node$getChildBy, _boardNode$getSibling;
          var boardNode = (_this$node$getChildBy = this.node.getChildByName('board')) != null ? _this$node$getChildBy : this.node.getChildByName('Board');
          this.pieceLayer = this.node.getChildByName('PieceLayer');
          if (!this.pieceLayer) {
            this.pieceLayer = new Node('PieceLayer');
            this.pieceLayer.setParent(this.node);
          }
          this.fxLayer = this.node.getChildByName('FxLayer');
          if (!this.fxLayer) {
            this.fxLayer = new Node('FxLayer');
            this.fxLayer.setParent(this.node);
          }
          var boardIndex = (_boardNode$getSibling = boardNode == null ? void 0 : boardNode.getSiblingIndex()) != null ? _boardNode$getSibling : 0;
          this.pieceLayer.setSiblingIndex(Math.min(boardIndex + 1, this.node.children.length - 1));
          this.fxLayer.setSiblingIndex(Math.min(this.pieceLayer.getSiblingIndex() + 1, this.node.children.length - 1));
        };
        _proto.getPieceLayer = function getPieceLayer() {
          var _this$pieceLayer;
          return (_this$pieceLayer = this.pieceLayer) != null && _this$pieceLayer.isValid ? this.pieceLayer : this.node;
        };
        _proto.getFxLayer = function getFxLayer() {
          var _this$fxLayer;
          return (_this$fxLayer = this.fxLayer) != null && _this$fxLayer.isValid ? this.fxLayer : this.node;
        }

        // 所有玩法短音效统一从这里转给音频管理器，空资源会被安全忽略。
        ;

        _proto.playSoundEffect = function playSoundEffect(clip) {
          var _this$audioManager2;
          (_this$audioManager2 = this.audioManager) == null || _this$audioManager2.playSoundEffect(clip);
        }

        /**
         * 播放带最小间隔的合并音效。
         *
         * 连续消除时视觉可以保持连贯，但音效如果贴得太近会失去“停顿”的节奏。
         * 这里仅对合并音效做间隔控制，其他点击、技能、碰撞音效不受影响。
         */;
        _proto.playMergeSoundWithGap = /*#__PURE__*/
        function () {
          var _playMergeSoundWithGap = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee() {
            var now, elapsed, delay;
            return _regeneratorRuntime().wrap(function _callee$(_context) {
              while (1) switch (_context.prev = _context.next) {
                case 0:
                  if (this.landingMergeAudioClip) {
                    _context.next = 2;
                    break;
                  }
                  return _context.abrupt("return");
                case 2:
                  now = Date.now();
                  elapsed = (now - this.lastMergeSoundTimeMs) / 1000;
                  delay = Math.max(0, MERGE_SOUND_MIN_INTERVAL - elapsed);
                  if (!(delay > 0)) {
                    _context.next = 8;
                    break;
                  }
                  _context.next = 8;
                  return this.waitSeconds(delay);
                case 8:
                  this.lastMergeSoundTimeMs = Date.now();
                  this.playSoundEffect(this.landingMergeAudioClip);
                case 10:
                case "end":
                  return _context.stop();
              }
            }, _callee, this);
          }));
          function playMergeSoundWithGap() {
            return _playMergeSoundWithGap.apply(this, arguments);
          }
          return playMergeSoundWithGap;
        }() // 每帧更新当前下落棋子的目标位置，并在接近落点时触发落地结算。
        ;

        _proto.update = function update(dt) {
          if (!this.hasStartedSession) {
            return;
          }
          if (this.isSwapSkillActive) {
            // 技能态下不推进下落，只更新交换预览的惯性跟随。
            this.updateSwapDragMotion(dt);
            return;
          }
          if (this.isHammerSkillActive) {
            return;
          }
          if (this.isBombSkillActive) {
            return;
          }
          if (!this.currentPiece || this.isGameOver || this.isResolving || this.isPaused) {
            return;
          }
          var row = this.getDropRow(this.currentColumn);
          if (row < 0) {
            var fallbackColumn = this.getNearestAvailableColumn(this.currentColumn);
            if (fallbackColumn < 0) {
              this.endGame();
              return;
            }
            this.currentColumn = fallbackColumn;
          }
          var dropRow = this.getDropRow(this.currentColumn);
          if (dropRow < 0) {
            this.endGame();
            return;
          }
          var speed = this.isFastDropping ? this.fastFallSpeed : this.fallSpeed;
          var targetPosition = this.getCellPosition(dropRow, this.currentColumn);
          var currentPosition = this.currentPiece.node.position.clone();
          var nextY = Math.max(targetPosition.y, currentPosition.y - speed * dt);
          this.currentPiece.syncTrailEffect();
          this.currentPiece.node.setPosition(targetPosition.x, nextY, 0);
          // this.updateFallingTrail(dt)

          if (nextY <= targetPosition.y + 1) {
            void this.landPiece(dropRow, this.currentColumn);
          }
        }

        // 绑定全局触摸事件，玩家通过按下位置选择列，并用按住实现快速下落。
        ;

        _proto.bindInput = function bindInput() {
          this.node.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
          this.node.on(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this);
          this.node.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
          this.node.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
        }
        // 触摸按下时确定列并开启快速下落
        ;

        _proto.handleTouchStart = function handleTouchStart(event) {
          if (this.isGameOver) {
            void this.restartGame();
            return;
          }
          if (!this.hasStartedSession) {
            return;
          }
          if (this.isSwapSkillActive) {
            this.handleSwapSkillTouchStart(event);
            return;
          }
          if (this.isHammerSkillActive) {
            void this.handleHammerSkillTouchStart(event);
            return;
          }
          if (this.isBombSkillActive) {
            void this.handleBombSkillTouchStart(event);
            return;
          }
          if (!this.currentPiece || this.isResolving || this.isPaused) {
            return;
          }
          var column = this.getColumnFromTouch(event);
          if (column < 0) {
            return;
          }
          var availableColumn = this.getNearestAvailableColumn(column);
          if (availableColumn >= 0) {
            this.currentColumn = availableColumn;
            this.isFastDropping = true;
            this.trailTimer = 0;
            this.refreshUiState();
          }
        }

        // 技能拖拽期间移动被选中的棋子，普通模式下不处理移动事件。
        ;

        _proto.handleTouchMove = function handleTouchMove(event) {
          if (!this.hasStartedSession) {
            return;
          }
          if (!this.isSwapSkillActive) {
            return;
          }
          this.handleSwapSkillTouchMove(event);
        }

        // 触摸抬起时结束本次按住状态；当前逻辑中只需要停止继续加速即可。
        ;

        _proto.handleTouchEnd = function handleTouchEnd(event) {
          if (!this.hasStartedSession) {
            return;
          }
          if (this.isSwapSkillActive) {
            void this.handleSwapSkillTouchEnd(event);
            return;
          }
          if (!this.currentPiece || this.isGameOver || this.isResolving || this.isPaused) {
            return;
          }

          // 只有在手指仍按住时才保持快速下落，抬起或取消触摸后要立即恢复正常速度。
          // this.isFastDropping = false
        }

        // 触摸被系统取消时不能执行技能交换，只恢复拖拽棋子，避免切后台等场景误触发。
        ;

        _proto.handleTouchCancel = function handleTouchCancel() {
          if (!this.hasStartedSession) {
            return;
          }
          if (this.isSwapSkillActive && this.swapDragState) {
            void this.restoreSwapDraggedPiece(this.swapDragState);
          }
        }

        // 锤子技能点选任意落地棋子后立即敲碎，并在动画后触发重力和消除检测。
        ;

        _proto.handleHammerSkillTouchStart = /*#__PURE__*/
        function () {
          var _handleHammerSkillTouchStart = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee2(event) {
            var target, piece;
            return _regeneratorRuntime().wrap(function _callee2$(_context2) {
              while (1) switch (_context2.prev = _context2.next) {
                case 0:
                  if (!this.isResolving) {
                    _context2.next = 2;
                    break;
                  }
                  return _context2.abrupt("return");
                case 2:
                  target = this.getCellFromTouch(event);
                  if (target) {
                    _context2.next = 5;
                    break;
                  }
                  return _context2.abrupt("return");
                case 5:
                  piece = this.board[target.row][target.column];
                  if (piece) {
                    _context2.next = 8;
                    break;
                  }
                  return _context2.abrupt("return");
                case 8:
                  event.propagationStopped = true;
                  _context2.next = 11;
                  return this.executeHammerSkill(target, piece);
                case 11:
                case "end":
                  return _context2.stop();
              }
            }, _callee2, this);
          }));
          function handleHammerSkillTouchStart(_x) {
            return _handleHammerSkillTouchStart.apply(this, arguments);
          }
          return handleHammerSkillTouchStart;
        }() // 炸弹技能点选中心棋子后，会收集周围九宫格内所有已落地棋子并统一炸碎。
        ;

        _proto.handleBombSkillTouchStart = /*#__PURE__*/
        function () {
          var _handleBombSkillTouchStart = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee3(event) {
            var target;
            return _regeneratorRuntime().wrap(function _callee3$(_context3) {
              while (1) switch (_context3.prev = _context3.next) {
                case 0:
                  if (!this.isResolving) {
                    _context3.next = 2;
                    break;
                  }
                  return _context3.abrupt("return");
                case 2:
                  target = this.getCellFromTouch(event);
                  if (!(!target || !this.board[target.row][target.column])) {
                    _context3.next = 5;
                    break;
                  }
                  return _context3.abrupt("return");
                case 5:
                  event.propagationStopped = true;
                  _context3.next = 8;
                  return this.executeBombSkill(target);
                case 8:
                case "end":
                  return _context3.stop();
              }
            }, _callee3, this);
          }));
          function handleBombSkillTouchStart(_x2) {
            return _handleBombSkillTouchStart.apply(this, arguments);
          }
          return handleBombSkillTouchStart;
        }() // 重置棋盘数据，并把默认目标列放在中间列。
        ;

        _proto.resetBoard = function resetBoard() {
          this.board = this.boardModel.createEmptyBoard(this.boardheight, this.boardwidth);
          // 重开或首次进入时，分数统计要和棋盘一起清零。
          this.scoreManager.reset();
          this.gameOverCoinReward = 0;
          this.usedSkillsThisGame = this.createEmptySkillUsageState();
          this.currentColumn = Math.floor(this.boardwidth / 2);
          this.nextPieceValue = this.randomBasePieceValue();
          this.lastMergeSoundTimeMs = -Infinity;
        }

        // 返回首页前生成纯数据快照，节点和组件不会跨场景泄漏。
        ;

        _proto.buildOngoingGameSnapshot = function buildOngoingGameSnapshot() {
          var _this$currentPiece$ge, _this$currentPiece, _this$currentPiece$no, _this$currentPiece2;
          return {
            boardValues: this.board.map(function (row) {
              return row.map(function (piece) {
                var _piece$getValue;
                return (_piece$getValue = piece == null ? void 0 : piece.getValue()) != null ? _piece$getValue : null;
              });
            }),
            currentPieceValue: (_this$currentPiece$ge = (_this$currentPiece = this.currentPiece) == null ? void 0 : _this$currentPiece.getValue()) != null ? _this$currentPiece$ge : null,
            nextPieceValue: this.nextPieceValue,
            currentPieceY: (_this$currentPiece$no = (_this$currentPiece2 = this.currentPiece) == null ? void 0 : _this$currentPiece2.node.position.y) != null ? _this$currentPiece$no : null,
            currentColumn: this.currentColumn,
            bonusScore: this.scoreManager.getBonusScore(),
            highestPieceValue: this.scoreManager.getHighestPieceValue(),
            usedSkillsThisGame: _extends({}, this.usedSkillsThisGame)
          };
        }

        /**
         * 从首页续局时重建棋盘节点。
         *
         * 快照只保存数字和当前落子位置；所有节点仍由 piece.prefab 重新实例化，
         * 因此不会破坏棋子生命周期、棋盘查询或 UI 单向渲染边界。
         */;
        _proto.restoreOngoingGame = function restoreOngoingGame(snapshot) {
          var _snapshot$nextPieceVa, _snapshot$usedSkillsT, _snapshot$usedSkillsT2, _snapshot$usedSkillsT3;
          if (!this.basePieceController) {
            OngoingGameSession.finishGame();
            return;
          }
          for (var row = 0; row < this.boardheight; row += 1) {
            for (var column = 0; column < this.boardwidth; column += 1) {
              var _snapshot$boardValues, _snapshot$boardValues2;
              var value = (_snapshot$boardValues = (_snapshot$boardValues2 = snapshot.boardValues[row]) == null ? void 0 : _snapshot$boardValues2[column]) != null ? _snapshot$boardValues : null;
              if (value === null) {
                continue;
              }
              var piece = this.instantiateSnapshotPiece(value);
              if (!piece) {
                continue;
              }
              this.board[row][column] = piece;
              piece.node.setPosition(this.getCellPosition(row, column));
              piece.stopParticle();
            }
          }
          this.scoreManager.restore(snapshot.bonusScore, snapshot.highestPieceValue);
          this.nextPieceValue = (_snapshot$nextPieceVa = snapshot.nextPieceValue) != null ? _snapshot$nextPieceVa : this.randomBasePieceValue();
          this.usedSkillsThisGame = {
            bomb: !!((_snapshot$usedSkillsT = snapshot.usedSkillsThisGame) != null && _snapshot$usedSkillsT.bomb),
            hammer: !!((_snapshot$usedSkillsT2 = snapshot.usedSkillsThisGame) != null && _snapshot$usedSkillsT2.hammer),
            swap: !!((_snapshot$usedSkillsT3 = snapshot.usedSkillsThisGame) != null && _snapshot$usedSkillsT3.swap)
          };
          var requestedColumn = Math.max(0, Math.min(this.boardwidth - 1, Math.floor(snapshot.currentColumn)));
          var availableColumn = this.getNearestAvailableColumn(requestedColumn);
          if (snapshot.currentPieceValue !== null && availableColumn >= 0) {
            var _piece = this.instantiateSnapshotPiece(snapshot.currentPieceValue);
            var dropRow = this.getDropRow(availableColumn);
            if (_piece && dropRow >= 0) {
              var _snapshot$currentPiec;
              var spawnPosition = this.getSpawnPosition(availableColumn);
              var targetPosition = this.getCellPosition(dropRow, availableColumn);
              var restoredY = Math.max(targetPosition.y, Math.min(spawnPosition.y, (_snapshot$currentPiec = snapshot.currentPieceY) != null ? _snapshot$currentPiec : spawnPosition.y));
              _piece.node.setPosition(spawnPosition.x, restoredY, spawnPosition.z);
              this.currentColumn = availableColumn;
              this.currentPiece = _piece;
            }
          }
          this.isFastDropping = false;
          this.isResolving = false;
          this.isPaused = false;
          this.refreshUiState();
        }

        // 续局棋子统一从原 Prefab 创建，避免快照恢复产生另一套棋子表现。
        ;

        _proto.instantiateSnapshotPiece = function instantiateSnapshotPiece(value) {
          var _pieceNode$getCompone;
          if (!this.basePieceController) {
            return null;
          }
          var pieceNode = instantiate(this.basePieceController);
          var pieceController = pieceNode.getComponent(PieceController);
          if (!pieceController) {
            pieceNode.destroy();
            return null;
          }
          (_pieceNode$getCompone = pieceNode.getComponent(UITransform)) == null || _pieceNode$getCompone.setContentSize(this.pieceSize, this.pieceSize);
          pieceController.setValue(value);
          pieceNode.setScale(Vec3.ONE);
          this.getPieceLayer().addChild(pieceNode);
          pieceController.syncLayout(true);
          return pieceController;
        }

        // 清理棋盘中已经实例化的棋子节点，返回首页和重新开始都复用这套收口逻辑。
        ;

        _proto.clearBoardPieces = function clearBoardPieces() {
          this.boardModel.destroyBoardPieces(this.board, this.boardheight, this.boardwidth);
          if (this.currentPiece) {
            if (this.currentPiece.node.isValid) {
              // 当前下落棋子不在 board 数组里，销毁前也要单独停止动画。
              Tween.stopAllByTarget(this.currentPiece.node);
              this.currentPiece.node.destroy();
            }
            this.currentPiece = null;
          }
        }

        /**
         * 生成下一颗可操作棋子并放到出生区。
         *
         * 这里只负责实例化预制体、同步棋盘格子尺寸、消费预览数值和刷新 UI 状态。
         * 如果当前棋盘已经没有可落子列，会直接进入游戏结束流程。
         */;
        _proto.spawnPiece = function spawnPiece() {
          if (this.isBoardFull() || !this.basePieceController) {
            this.endGame();
            return;
          }
          var column = this.getNearestAvailableColumn(Math.floor(this.boardwidth / 2));
          if (column < 0) {
            this.endGame();
            return;
          }
          var pieceNode = instantiate(this.basePieceController);
          var pieceController = pieceNode.getComponent(PieceController);
          if (!pieceController) {
            pieceNode.destroy();
            return;
          }
          var pieceTransform = pieceNode.getComponent(UITransform);
          if (pieceTransform) {
            // 让预制体的真实显示尺寸和当前棋盘格子尺寸保持一致。
            pieceTransform.setContentSize(this.pieceSize, this.pieceSize);
          }
          var value = this.nextPieceValue;
          this.nextPieceValue = this.randomBasePieceValue();
          this.currentColumn = column;
          this.isFastDropping = false;
          this.trailTimer = 0;
          pieceController.setValue(value);
          // 棋子尺寸由棋盘动态决定，主体、装饰、数字和拖尾在设值后统一校准。
          pieceController.syncLayout(true);
          this.scoreManager.updateHighestPieceValue(value);
          pieceNode.setScale(Vec3.ONE);
          pieceNode.setPosition(this.getSpawnPosition(column));
          this.getPieceLayer().addChild(pieceNode);
          this.currentPiece = pieceController;
          this.refreshUiState();
        }

        /**
         * 将当前下落棋子写入棋盘并启动完整落地结算。
         *
         * 落地后先停止拖尾并固定棋子坐标，再执行“落地点定向连锁合并”，
         * 最后进入统一的重力和全盘合并循环。整个过程中通过 `isResolving`
         * 冻结输入，避免异步动画期间棋盘状态被再次修改。
         *
         * @param row 落地行，row 从底部向上递增。
         * @param column 落地列，column 从左向右递增。
         */;
        _proto.landPiece = /*#__PURE__*/
        function () {
          var _landPiece = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee4(row, column) {
            var landedPiece, willMergeOnLanding, directedResult;
            return _regeneratorRuntime().wrap(function _callee4$(_context4) {
              while (1) switch (_context4.prev = _context4.next) {
                case 0:
                  if (!(!this.currentPiece || this.isResolving)) {
                    _context4.next = 2;
                    break;
                  }
                  return _context4.abrupt("return");
                case 2:
                  this.currentPiece.stopParticle();
                  this.isResolving = true;
                  landedPiece = this.currentPiece;
                  this.currentPiece = null;
                  this.transientFx.clear();
                  this.board[row][column] = landedPiece;
                  landedPiece.node.setPosition(this.getCellPosition(row, column));
                  this.refreshUiState();
                  willMergeOnLanding = this.canPieceMergeNow(landedPiece);
                  if (!willMergeOnLanding) {
                    this.playSoundEffect(this.collisionAudioClip);
                  }
                  _context4.next = 14;
                  return this.resolveLandingChain(landedPiece);
                case 14:
                  directedResult = _context4.sent;
                  _context4.next = 17;
                  return this.settleBoard(directedResult.anchor);
                case 17:
                  this.isResolving = false;
                  this.refreshUiState();
                  if (!this.isBoardFull()) {
                    _context4.next = 22;
                    break;
                  }
                  this.endGame();
                  return _context4.abrupt("return");
                case 22:
                  this.spawnPiece();
                case 23:
                case "end":
                  return _context4.stop();
              }
            }, _callee4, this);
          }));
          function landPiece(_x3, _x4) {
            return _landPiece.apply(this, arguments);
          }
          return landPiece;
        }()
        /**
         * 反复执行重力下落和全盘合并，直到棋盘稳定。
         *
         * 每轮先把所有列向下压缩，再扫描全盘可合并组。
         * 如果没有合并但发生过重力移动，会继续下一轮扫描，确保重力导致的新相邻组也能被处理。
         *
         * @param preferredAnchor 优先保留的合并锚点，通常来自刚刚落地或连锁产生的棋子。
         */;

        _proto.settleBoard = /*#__PURE__*/
        function () {
          var _settleBoard = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee5(preferredAnchor) {
            var chainDepth, moved, groups;
            return _regeneratorRuntime().wrap(function _callee5$(_context5) {
              while (1) switch (_context5.prev = _context5.next) {
                case 0:
                  chainDepth = 1;
                case 1:
                  _context5.next = 4;
                  return this.applyGravityAllColumns();
                case 4:
                  moved = _context5.sent;
                  groups = this.findMergeGroups(preferredAnchor);
                  if (!(groups.length === 0)) {
                    _context5.next = 11;
                    break;
                  }
                  if (moved) {
                    _context5.next = 9;
                    break;
                  }
                  return _context5.abrupt("return");
                case 9:
                  preferredAnchor = null;
                  return _context5.abrupt("continue", 1);
                case 11:
                  _context5.next = 13;
                  return this.playMergeGroups(groups, chainDepth);
                case 13:
                  chainDepth += 1;
                  preferredAnchor = null;
                  _context5.next = 1;
                  break;
                case 17:
                case "end":
                  return _context5.stop();
              }
            }, _callee5, this);
          }));
          function settleBoard(_x5) {
            return _settleBoard.apply(this, arguments);
          }
          return settleBoard;
        }() // 进入交换技能后的第一次按下只允许选择棋盘内已经落地的棋子。
        ;

        _proto.handleSwapSkillTouchStart = function handleSwapSkillTouchStart(event) {
          var _piece$node$parent;
          if (this.isResolving || this.swapDragState) {
            return;
          }
          var source = this.getCellFromTouch(event);
          if (!source) {
            return;
          }
          var piece = this.board[source.row][source.column];
          if (!piece) {
            return;
          }
          event.propagationStopped = true;
          Tween.stopAllByTarget(piece.node);
          this.swapDragState = {
            source: source,
            piece: piece,
            originalPosition: piece.node.position.clone(),
            originalScale: piece.node.scale.clone(),
            originalSiblingIndex: piece.node.getSiblingIndex(),
            dragAxis: null,
            previewTarget: null,
            previewPiece: null,
            desiredPiecePosition: piece.node.position.clone(),
            desiredPreviewPiecePosition: null
          };
          // 被拖动的棋子临时提到更高层级，避免拖拽过程中被其他棋子遮住。
          var pieceParent = (_piece$node$parent = piece.node.parent) != null ? _piece$node$parent : this.getPieceLayer();
          piece.node.setSiblingIndex(pieceParent.children.length - 1);
          piece.node.setScale(new Vec3(1.08, 1.08, 1));
          this.moveSwapDragPiece(event);
        }

        // 拖拽过程中让棋子跟随手指，释放时再判断是否落在相邻棋子上。
        ;

        _proto.handleSwapSkillTouchMove = function handleSwapSkillTouchMove(event) {
          if (!this.swapDragState || this.isResolving) {
            return;
          }
          event.propagationStopped = true;
          this.moveSwapDragPiece(event);
        }

        // 交换技能释放时只接受相邻且非空的目标格，否则回到起点继续等待玩家操作。
        ;

        _proto.handleSwapSkillTouchEnd = /*#__PURE__*/
        function () {
          var _handleSwapSkillTouchEnd = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee6(event) {
            var dragState, target, targetPiece;
            return _regeneratorRuntime().wrap(function _callee6$(_context6) {
              while (1) switch (_context6.prev = _context6.next) {
                case 0:
                  if (!(!this.swapDragState || this.isResolving)) {
                    _context6.next = 2;
                    break;
                  }
                  return _context6.abrupt("return");
                case 2:
                  event.propagationStopped = true;
                  dragState = this.swapDragState;
                  target = this.getSwapTargetFromDrag(event, dragState, true);
                  if (!(!target || !this.canSwapCells(dragState.source, target))) {
                    _context6.next = 9;
                    break;
                  }
                  _context6.next = 8;
                  return this.restoreSwapDraggedPiece(dragState);
                case 8:
                  return _context6.abrupt("return");
                case 9:
                  this.syncSwapPreviewPiece(dragState, target);
                  targetPiece = this.board[target.row][target.column];
                  if (targetPiece) {
                    _context6.next = 15;
                    break;
                  }
                  _context6.next = 14;
                  return this.restoreSwapDraggedPiece(dragState);
                case 14:
                  return _context6.abrupt("return");
                case 15:
                  this.swapDragState = null;
                  _context6.next = 18;
                  return this.executeSwapSkill(dragState, target);
                case 18:
                case "end":
                  return _context6.stop();
              }
            }, _callee6, this);
          }));
          function handleSwapSkillTouchEnd(_x6) {
            return _handleSwapSkillTouchEnd.apply(this, arguments);
          }
          return handleSwapSkillTouchEnd;
        }() // 拖拽坐标统一转成 play 节点本地坐标，保证棋子跟手时不受屏幕分辨率影响。
        ;

        _proto.moveSwapDragPiece = function moveSwapDragPiece(event) {
          if (!this.swapDragState) {
            return;
          }
          var preview = this.getSwapDragPreview(event, this.swapDragState);
          if (!preview) {
            return;
          }
          this.syncSwapPreviewPiece(this.swapDragState, preview.target);
          this.swapDragState.previewTarget = preview.target;
          this.swapDragState.desiredPiecePosition = preview.position;
          this.swapDragState.desiredPreviewPiecePosition = preview.previewPiecePosition;
        }

        // 无效释放不会消耗技能，只把棋子动画退回原来的格子。
        ;

        _proto.restoreSwapDraggedPiece = /*#__PURE__*/
        function () {
          var _restoreSwapDraggedPiece = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee7(dragState) {
            var animations;
            return _regeneratorRuntime().wrap(function _callee7$(_context7) {
              while (1) switch (_context7.prev = _context7.next) {
                case 0:
                  this.swapDragState = null;
                  animations = [this.animateSwapMove(dragState.piece.node, dragState.originalPosition, dragState.originalScale, 0.12)];
                  if (dragState.previewPiece && dragState.previewTarget) {
                    // 无效释放时，相邻被预览挤开的棋子也要回到自己的格子。
                    animations.push(this.animateSwapMove(dragState.previewPiece.node, this.getCellPosition(dragState.previewTarget.row, dragState.previewTarget.column), Vec3.ONE, 0.12));
                  }
                  _context7.next = 5;
                  return Promise.all(animations);
                case 5:
                  this.restoreSwapPieceLayer(dragState);
                case 6:
                case "end":
                  return _context7.stop();
              }
            }, _callee7, this);
          }));
          function restoreSwapDraggedPiece(_x7) {
            return _restoreSwapDraggedPiece.apply(this, arguments);
          }
          return restoreSwapDraggedPiece;
        }() // 根据当前有效目标同步被挤开的相邻棋子，目标变化时先让旧目标回到原格。
        ;

        _proto.syncSwapPreviewPiece = function syncSwapPreviewPiece(dragState, target) {
          var nextPiece = target ? this.board[target.row][target.column] : null;
          if (dragState.previewPiece === nextPiece) {
            return;
          }
          if (dragState.previewPiece && dragState.previewTarget) {
            void this.animateSwapMove(dragState.previewPiece.node, this.getCellPosition(dragState.previewTarget.row, dragState.previewTarget.column), Vec3.ONE, 0.08);
          }
          dragState.previewPiece = nextPiece;
        }

        // 拖拽预览用插值靠近目标位置，形成一点惯性，不再像普通拖拽一样硬贴手指。
        ;

        _proto.updateSwapDragMotion = function updateSwapDragMotion(dt) {
          if (!this.swapDragState || this.isResolving) {
            return;
          }
          var dragState = this.swapDragState;
          this.lerpNodePosition(dragState.piece.node, dragState.desiredPiecePosition, dt, 18);
          if (dragState.previewPiece && dragState.desiredPreviewPiecePosition) {
            this.lerpNodePosition(dragState.previewPiece.node, dragState.desiredPreviewPiecePosition, dt, 14);
          }
        }

        // 简单的一阶插值足够模拟三消拖拽的惯性，同时不会引入额外 Tween 冲突。
        ;

        _proto.lerpNodePosition = function lerpNodePosition(node, target, dt, speed) {
          var current = node.position;
          var factor = Math.min(1, dt * speed);
          node.setPosition(current.x + (target.x - current.x) * factor, current.y + (target.y - current.y) * factor, current.z + (target.z - current.z) * factor);
        }

        // 被拖动棋子在拖拽、交换和回弹期间保持上层，流程结束后再恢复原来的层级。
        ;

        _proto.restoreSwapPieceLayer = function restoreSwapPieceLayer(dragState) {
          var _dragState$piece$node, _dragState$piece$node2;
          if (!((_dragState$piece$node = dragState.piece.node) != null && _dragState$piece$node.isValid)) {
            return;
          }
          var pieceParent = (_dragState$piece$node2 = dragState.piece.node.parent) != null ? _dragState$piece$node2 : this.getPieceLayer();
          dragState.piece.node.setSiblingIndex(Math.min(dragState.originalSiblingIndex, pieceParent.children.length - 1));
        }

        // 真正执行交换：先改棋盘数据，再播放双向移动，随后复用现有全盘消除结算。
        ;

        _proto.executeSwapSkill = /*#__PURE__*/
        function () {
          var _executeSwapSkill = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee8(dragState, target) {
            var source, sourcePiece, targetPiece;
            return _regeneratorRuntime().wrap(function _callee8$(_context8) {
              while (1) switch (_context8.prev = _context8.next) {
                case 0:
                  source = dragState.source;
                  sourcePiece = this.board[source.row][source.column];
                  targetPiece = this.board[target.row][target.column];
                  if (!(!sourcePiece || !targetPiece)) {
                    _context8.next = 5;
                    break;
                  }
                  return _context8.abrupt("return");
                case 5:
                  this.isResolving = true;
                  this.board[source.row][source.column] = targetPiece;
                  this.board[target.row][target.column] = sourcePiece;
                  this.refreshUiState();
                  _context8.next = 11;
                  return Promise.all([this.animateSwapMove(sourcePiece.node, this.getCellPosition(target.row, target.column), Vec3.ONE, 0.18), this.animateSwapMove(targetPiece.node, this.getCellPosition(source.row, source.column), Vec3.ONE, 0.18)]);
                case 11:
                  if (!(this.findMergeGroups(sourcePiece).length === 0)) {
                    _context8.next = 19;
                    break;
                  }
                  this.playSoundEffect(this.swapRollbackAudioClip);
                  _context8.next = 15;
                  return this.rollbackSwapSkill(dragState, target);
                case 15:
                  this.restoreSwapPieceLayer(dragState);
                  this.isResolving = false;
                  this.refreshUiState();
                  return _context8.abrupt("return");
                case 19:
                  if (this.economy.consumeSkill('swap')) {
                    this.markSkillUsedThisGame('swap');
                  }
                  this.playSoundEffect(this.soundEffectClips.swapSkillAudioClip);
                  this.refreshUiState();
                  _context8.next = 24;
                  return this.settleBoard(sourcePiece);
                case 24:
                  this.restoreSwapPieceLayer(dragState);
                  this.isResolving = false;
                  this.isSwapSkillActive = false;
                  this.refreshUiState();
                case 28:
                case "end":
                  return _context8.stop();
              }
            }, _callee8, this);
          }));
          function executeSwapSkill(_x8, _x9) {
            return _executeSwapSkill.apply(this, arguments);
          }
          return executeSwapSkill;
        }() // 交换后如果没有形成任何可消除连通组，需要把棋盘数据和视觉都回弹到交换前。
        ;

        _proto.rollbackSwapSkill = /*#__PURE__*/
        function () {
          var _rollbackSwapSkill = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee9(dragState, target) {
            var source, sourcePiece, targetPiece;
            return _regeneratorRuntime().wrap(function _callee9$(_context9) {
              while (1) switch (_context9.prev = _context9.next) {
                case 0:
                  source = dragState.source;
                  sourcePiece = this.board[target.row][target.column];
                  targetPiece = this.board[source.row][source.column];
                  if (!(!sourcePiece || !targetPiece)) {
                    _context9.next = 5;
                    break;
                  }
                  return _context9.abrupt("return");
                case 5:
                  this.board[source.row][source.column] = sourcePiece;
                  this.board[target.row][target.column] = targetPiece;
                  _context9.next = 9;
                  return Promise.all([this.animateSwapMove(sourcePiece.node, this.getCellPosition(source.row, source.column), Vec3.ONE, 0.16), this.animateSwapMove(targetPiece.node, this.getCellPosition(target.row, target.column), Vec3.ONE, 0.16)]);
                case 9:
                case "end":
                  return _context9.stop();
              }
            }, _callee9, this);
          }));
          function rollbackSwapSkill(_x10, _x11) {
            return _rollbackSwapSkill.apply(this, arguments);
          }
          return rollbackSwapSkill;
        }() // 交换动画不复用普通落子移动，因为技能交换需要更明显的双向位移动画。
        ;

        _proto.animateSwapMove = function animateSwapMove(node, position, scale, duration) {
          Tween.stopAllByTarget(node);
          return new Promise(function (resolve) {
            tween(node).parallel(tween().to(duration, {
              position: position
            }, {
              easing: 'quadOut'
            }), tween().to(duration, {
              scale: scale
            }, {
              easing: 'quadOut'
            })).call(resolve).start();
          });
        }

        // 相邻交换只允许上下左右一格，不能斜向交换，也不能原地释放。
        ;

        _proto.canSwapCells = function canSwapCells(source, target) {
          if (!this.isInsideBoard(target.row, target.column)) {
            return false;
          }
          var distance = Math.abs(source.row - target.row) + Math.abs(source.column - target.column);
          return distance === 1;
        }

        // 技能拖拽只允许横向或纵向预览，边缘向外和空格方向都不会产生视觉位移。
        ;

        _proto.getSwapDragPreview = function getSwapDragPreview(event, dragState) {
          var localPosition = this.getLocalPositionFromTouch(event);
          if (!localPosition) {
            return null;
          }
          var step = this.getStepSize();
          var deltaX = localPosition.x - dragState.originalPosition.x;
          var deltaY = localPosition.y - dragState.originalPosition.y;
          var absX = Math.abs(deltaX);
          var absY = Math.abs(deltaY);
          if (Math.max(absX, absY) < step * 0.12) {
            dragState.dragAxis = null;
            return {
              position: dragState.originalPosition,
              target: null,
              previewPiecePosition: null
            };
          }

          // 每次拖动都按当前热区重新判断方向：上下位移更大走纵向，否则走横向。
          dragState.dragAxis = absY > absX ? 'vertical' : 'horizontal';
          var axisDelta = dragState.dragAxis === 'horizontal' ? deltaX : deltaY;
          var direction = axisDelta >= 0 ? 1 : -1;
          var target = this.getSwapTargetFromDelta(dragState, direction);
          if (!target || !this.board[target.row][target.column]) {
            // 边缘棋子向边缘外拖动时直接保持原位，不给错误的可交换暗示。
            return {
              position: dragState.originalPosition,
              target: null,
              previewPiecePosition: null
            };
          }
          var distance = Math.min(Math.abs(axisDelta), step);
          var position = dragState.originalPosition.clone();
          if (dragState.dragAxis === 'horizontal') {
            position.x += direction * distance;
          } else {
            position.y += direction * distance;
          }
          var targetOrigin = this.getCellPosition(target.row, target.column);
          var previewPiecePosition = targetOrigin.clone();
          if (dragState.dragAxis === 'horizontal') {
            previewPiecePosition.x -= direction * distance;
          } else {
            previewPiecePosition.y -= direction * distance;
          }
          return {
            position: position,
            target: target,
            previewPiecePosition: previewPiecePosition
          };
        }

        // 释放时必须拖过半格才算选择相邻目标，轻微误触只会回到原位。
        ;

        _proto.getSwapTargetFromDrag = function getSwapTargetFromDrag(event, dragState, requireThreshold) {
          var preview = this.getSwapDragPreview(event, dragState);
          if (!preview || !dragState.dragAxis || !preview.target) {
            return null;
          }
          if (!requireThreshold) {
            return preview.target;
          }
          var distance = Math.hypot(preview.position.x - dragState.originalPosition.x, preview.position.y - dragState.originalPosition.y);
          return distance >= this.getStepSize() * 0.45 ? preview.target : null;
        }

        // 根据锁定轴和方向换算相邻目标格，越界时直接视为无效目标。
        ;

        _proto.getSwapTargetFromDelta = function getSwapTargetFromDelta(dragState, direction) {
          var target = {
            row: dragState.source.row + (dragState.dragAxis === 'vertical' ? direction : 0),
            column: dragState.source.column + (dragState.dragAxis === 'horizontal' ? direction : 0)
          };
          return this.isInsideBoard(target.row, target.column) ? target : null;
        }

        // 执行锤子技能：先把目标棋子从棋盘数组移除，再播放碎裂动画并进入现有结算流程。
        ;

        _proto.executeHammerSkill = /*#__PURE__*/
        function () {
          var _executeHammerSkill = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee10(target, piece) {
            return _regeneratorRuntime().wrap(function _callee10$(_context10) {
              while (1) switch (_context10.prev = _context10.next) {
                case 0:
                  this.isResolving = true;
                  this.board[target.row][target.column] = null;
                  if (this.economy.consumeSkill('hammer')) {
                    this.markSkillUsedThisGame('hammer');
                  }
                  this.playSoundEffect(this.soundEffectClips.hammerSkillAudioClip);
                  this.refreshUiState();
                  _context10.next = 7;
                  return this.animateHammerBreak(piece);
                case 7:
                  _context10.next = 9;
                  return this.settleBoard(null);
                case 9:
                  this.isResolving = false;
                  this.isHammerSkillActive = false;
                  this.refreshUiState();
                case 12:
                case "end":
                  return _context10.stop();
              }
            }, _callee10, this);
          }));
          function executeHammerSkill(_x12, _x13) {
            return _executeHammerSkill.apply(this, arguments);
          }
          return executeHammerSkill;
        }() // 锤子技能的表现先播放锤子敲击，再把棋子炸成碎片粒子。
        ;

        _proto.animateHammerBreak = /*#__PURE__*/
        function () {
          var _animateHammerBreak = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee11(piece) {
            var _node$getComponent;
            var node, origin, opacity;
            return _regeneratorRuntime().wrap(function _callee11$(_context11) {
              while (1) switch (_context11.prev = _context11.next) {
                case 0:
                  node = piece.node;
                  origin = node.position.clone();
                  _context11.next = 4;
                  return this.playHammerStrike(origin);
                case 4:
                  this.spawnMergeFlash(piece, origin, 2);
                  this.spawnSkillShatterParticles(piece, origin, 14, 1.1);
                  opacity = (_node$getComponent = node.getComponent(UIOpacity)) != null ? _node$getComponent : node.addComponent(UIOpacity);
                  _context11.next = 9;
                  return new Promise(function (resolve) {
                    Tween.stopAllByTarget(node);
                    Tween.stopAllByTarget(opacity);
                    tween(node).sequence(tween().to(0.05, {
                      scale: new Vec3(1.12, 0.86, 1),
                      position: origin.clone().add3f(0, -8, 0)
                    }, {
                      easing: 'quadIn'
                    }), tween().to(0.06, {
                      scale: new Vec3(0.92, 1.08, 1),
                      position: origin.clone().add3f(0, 4, 0)
                    }, {
                      easing: 'backOut'
                    }), tween().to(0.06, {
                      scale: new Vec3(0.08, 0.08, 1),
                      position: origin.clone().add3f(0, 10, 0)
                    }, {
                      easing: 'quadIn'
                    })).call(resolve).start();
                    tween(opacity).delay(0.06).to(0.1, {
                      opacity: 0
                    }, {
                      easing: 'quadIn'
                    }).start();
                  });
                case 9:
                  node.destroy();
                case 10:
                case "end":
                  return _context11.stop();
              }
            }, _callee11, this);
          }));
          function animateHammerBreak(_x14) {
            return _animateHammerBreak.apply(this, arguments);
          }
          return animateHammerBreak;
        }() // 执行炸弹技能：以点选棋子为中心，移除九宫格范围内最多 9 个棋子。
        ;

        _proto.executeBombSkill = /*#__PURE__*/
        function () {
          var _executeBombSkill = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee12(center) {
            var targets, centerPosition, _iterator, _step, target;
            return _regeneratorRuntime().wrap(function _callee12$(_context12) {
              while (1) switch (_context12.prev = _context12.next) {
                case 0:
                  targets = this.collectBombTargets(center);
                  if (!(targets.length === 0)) {
                    _context12.next = 3;
                    break;
                  }
                  return _context12.abrupt("return");
                case 3:
                  this.isResolving = true;
                  if (this.economy.consumeSkill('bomb')) {
                    this.markSkillUsedThisGame('bomb');
                  }
                  this.playSoundEffect(this.soundEffectClips.bombSkillAudioClip);
                  this.refreshUiState();
                  centerPosition = this.getCellPosition(center.row, center.column);
                  _context12.next = 10;
                  return this.playBombCast(centerPosition);
                case 10:
                  for (_iterator = _createForOfIteratorHelperLoose(targets); !(_step = _iterator()).done;) {
                    target = _step.value;
                    this.board[target.row][target.column] = null;
                  }
                  this.refreshUiState();
                  _context12.next = 14;
                  return this.shakeBombTargets(targets, centerPosition);
                case 14:
                  _context12.next = 16;
                  return this.animateBombBreakTargets(targets, centerPosition);
                case 16:
                  _context12.next = 18;
                  return this.settleBoard(null);
                case 18:
                  this.isResolving = false;
                  this.isBombSkillActive = false;
                  this.refreshUiState();
                case 21:
                case "end":
                  return _context12.stop();
              }
            }, _callee12, this);
          }));
          function executeBombSkill(_x15) {
            return _executeBombSkill.apply(this, arguments);
          }
          return executeBombSkill;
        }() // 炸弹范围固定为中心格周围 3x3，边缘位置会自然少于 9 个。
        ;

        _proto.collectBombTargets = function collectBombTargets(center) {
          var targets = [];
          for (var row = center.row - 1; row <= center.row + 1; row++) {
            for (var column = center.column - 1; column <= center.column + 1; column++) {
              if (!this.isInsideBoard(row, column)) {
                continue;
              }
              var piece = this.board[row][column];
              if (!piece) {
                continue;
              }
              targets.push({
                row: row,
                column: column,
                piece: piece,
                position: this.getCellPosition(row, column)
              });
            }
          }
          return targets;
        }

        // 炸弹施放动画先把炸弹抛到目标点，再通过快速抖动制造引爆前摇。
        ;

        _proto.playBombCast = /*#__PURE__*/
        function () {
          var _playBombCast = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee13(position) {
            var bombNode, opacity, startPosition;
            return _regeneratorRuntime().wrap(function _callee13$(_context13) {
              while (1) switch (_context13.prev = _context13.next) {
                case 0:
                  bombNode = this.createBombSkillNode(position);
                  if (bombNode) {
                    _context13.next = 3;
                    break;
                  }
                  return _context13.abrupt("return");
                case 3:
                  opacity = bombNode.addComponent(UIOpacity);
                  opacity.opacity = 0;
                  startPosition = position.clone().add3f(-this.pieceSize * 0.58, this.pieceSize * 1.04, 0);
                  bombNode.setPosition(startPosition);
                  _context13.next = 9;
                  return new Promise(function (resolve) {
                    Tween.stopAllByTarget(bombNode);
                    Tween.stopAllByTarget(opacity);
                    tween(bombNode).sequence(tween().parallel(tween().to(0.18, {
                      position: position,
                      scale: new Vec3(1.08, 1.08, 1)
                    }, {
                      easing: 'quadOut'
                    }), tween(opacity).to(0.08, {
                      opacity: 255
                    }, {
                      easing: 'quadOut'
                    })), tween().to(0.04, {
                      position: position.clone().add3f(-6, 4, 0),
                      scale: new Vec3(1.1, 1.1, 1)
                    }, {
                      easing: 'quadOut'
                    }), tween().to(0.04, {
                      position: position.clone().add3f(7, -3, 0),
                      scale: new Vec3(1.16, 1.16, 1)
                    }, {
                      easing: 'quadOut'
                    }), tween().to(0.04, {
                      position: position.clone().add3f(-4, -5, 0),
                      scale: new Vec3(1.22, 1.22, 1)
                    }, {
                      easing: 'quadOut'
                    }), tween().to(0.04, {
                      position: position,
                      scale: new Vec3(1.3, 1.3, 1)
                    }, {
                      easing: 'quadOut'
                    }), tween().to(0.06, {
                      scale: new Vec3(0.2, 0.2, 1)
                    }, {
                      easing: 'quadIn'
                    })).call(function () {
                      bombNode.destroy();
                      resolve();
                    }).start();
                    tween(opacity).delay(0.34).to(0.08, {
                      opacity: 0
                    }, {
                      easing: 'quadIn'
                    }).start();
                  });
                case 9:
                case "end":
                  return _context13.stop();
              }
            }, _callee13, this);
          }));
          function playBombCast(_x16) {
            return _playBombCast.apply(this, arguments);
          }
          return playBombCast;
        }() // 使用技能资源创建一次性炸弹节点，动画结束后销毁。
        ;

        _proto.createBombSkillNode = function createBombSkillNode(position) {
          if (!this.bombSkillSpriteFrame) {
            return null;
          }
          var bombNode = new Node('BombSkillFx');
          var transform = bombNode.addComponent(UITransform);
          transform.setContentSize(this.pieceSize * 1.12, this.pieceSize * 1.4);
          var sprite = bombNode.addComponent(Sprite);
          sprite.spriteFrame = this.bombSkillSpriteFrame;
          sprite.sizeMode = Sprite.SizeMode.CUSTOM;
          var fxLayer = this.getFxLayer();
          bombNode.setParent(fxLayer);
          bombNode.setSiblingIndex(fxLayer.children.length - 1);
          bombNode.setPosition(position);
          bombNode.setScale(new Vec3(0.72, 0.72, 1));
          return bombNode;
        }

        // 炸弹范围内的棋子向外炸开并淡出，最后统一销毁。
        ;

        _proto.shakeBombTargets = /*#__PURE__*/
        function () {
          var _shakeBombTargets = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee14(targets, centerPosition) {
            var animations;
            return _regeneratorRuntime().wrap(function _callee14$(_context14) {
              while (1) switch (_context14.prev = _context14.next) {
                case 0:
                  animations = targets.map(function (target) {
                    var node = target.piece.node;
                    var distanceX = Math.abs(target.position.x - centerPosition.x);
                    var distanceY = Math.abs(target.position.y - centerPosition.y);
                    var strength = distanceX < 1 && distanceY < 1 ? 8 : 5;
                    // 爆炸前让范围内棋子短促抖动，中心棋子抖动更强，提示玩家炸弹影响范围。
                    return new Promise(function (resolve) {
                      Tween.stopAllByTarget(node);
                      tween(node).sequence(tween().to(0.035, {
                        position: target.position.clone().add3f(-strength, strength * 0.45, 0)
                      }, {
                        easing: 'quadOut'
                      }), tween().to(0.035, {
                        position: target.position.clone().add3f(strength, -strength * 0.38, 0)
                      }, {
                        easing: 'quadOut'
                      }), tween().to(0.035, {
                        position: target.position.clone().add3f(-strength * 0.6, -strength * 0.5, 0)
                      }, {
                        easing: 'quadOut'
                      }), tween().to(0.035, {
                        position: target.position
                      }, {
                        easing: 'quadOut'
                      })).call(resolve).start();
                    });
                  });
                  _context14.next = 3;
                  return Promise.all(animations);
                case 3:
                case "end":
                  return _context14.stop();
              }
            }, _callee14);
          }));
          function shakeBombTargets(_x17, _x18) {
            return _shakeBombTargets.apply(this, arguments);
          }
          return shakeBombTargets;
        }() // 炸弹范围内的棋子炸成粒子并淡出，最后统一销毁。
        ;

        _proto.animateBombBreakTargets = /*#__PURE__*/
        function () {
          var _animateBombBreakTargets = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee15(targets, centerPosition) {
            var _this3 = this;
            var animations;
            return _regeneratorRuntime().wrap(function _callee15$(_context15) {
              while (1) switch (_context15.prev = _context15.next) {
                case 0:
                  animations = targets.map(function (target) {
                    var _node$getComponent2;
                    var node = target.piece.node;
                    var opacity = (_node$getComponent2 = node.getComponent(UIOpacity)) != null ? _node$getComponent2 : node.addComponent(UIOpacity);
                    var direction = target.position.clone().subtract(centerPosition);
                    if (Math.abs(direction.x) < 1 && Math.abs(direction.y) < 1) {
                      direction.set(0, 1, 0);
                    }
                    direction.normalize();
                    var endPosition = target.position.clone().add3f(direction.x * _this3.pieceSize * 0.18, direction.y * _this3.pieceSize * 0.18, 0);
                    _this3.spawnSkillShatterParticles(target.piece, target.position, 10, 1.35);
                    return new Promise(function (resolve) {
                      Tween.stopAllByTarget(node);
                      Tween.stopAllByTarget(opacity);
                      tween(node).parallel(tween().to(0.12, {
                        position: endPosition,
                        scale: new Vec3(0.06, 0.06, 1)
                      }, {
                        easing: 'quadOut'
                      }), tween(opacity).to(0.12, {
                        opacity: 0
                      }, {
                        easing: 'quadIn'
                      })).call(function () {
                        node.destroy();
                        resolve();
                      }).start();
                    });
                  });
                  this.spawnBombShockwave(centerPosition, targets.length);
                  _context15.next = 4;
                  return Promise.all(animations);
                case 4:
                case "end":
                  return _context15.stop();
              }
            }, _callee15, this);
          }));
          function animateBombBreakTargets(_x19, _x20) {
            return _animateBombBreakTargets.apply(this, arguments);
          }
          return animateBombBreakTargets;
        }()
        /**
         * 生成技能消除专用碎片。
         *
         * 从被消除棋子的贴图和底色派生多个小碎片，沿圆周方向喷射并淡出。
         * 所有碎片都会登记到 transientFx，保证返回首页、重开或落地清理时不会残留。
         *
         * @param piece 提供贴图和底色参考的棋子。
         * @param position 碎片爆发中心。
         * @param count 碎片数量。
         * @param forceScale 扩散距离缩放，炸弹会比锤子更大。
         */;

        _proto.spawnSkillShatterParticles = function spawnSkillShatterParticles(piece, position, count, forceScale) {
          var _this4 = this;
          if (!this.transientFx.canRegister(count)) {
            return;
          }
          var spriteFrame = piece.getSpriteFrame();
          var baseColor = piece.getBackgroundColor();
          var particleSize = Math.max(10, this.pieceSize * 0.16);
          var _loop = function _loop() {
            var particle = new Node('SkillShatterParticle');
            var transform = particle.addComponent(UITransform);
            var sizeScale = 0.72 + Math.random() * 0.72;
            transform.setContentSize(particleSize * sizeScale, particleSize * sizeScale);
            var sprite = particle.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = spriteFrame;
            // 粒子颜色在原棋子颜色上做轻微提亮，避免碎片混在背景里看不清。
            sprite.color = new Color(Math.min(255, baseColor.r + 35 + Math.random() * 24), Math.min(255, baseColor.g + 35 + Math.random() * 24), Math.min(255, baseColor.b + 35 + Math.random() * 24), 255);
            var opacity = particle.addComponent(UIOpacity);
            opacity.opacity = 230;
            var fxLayer = _this4.getFxLayer();
            particle.setParent(fxLayer);
            particle.setSiblingIndex(fxLayer.children.length - 1);
            particle.setPosition(position.clone().add3f((Math.random() - 0.5) * _this4.pieceSize * 0.28, (Math.random() - 0.5) * _this4.pieceSize * 0.28, 0));
            particle.setScale(new Vec3(0.8, 0.8, 1));
            _this4.transientFx.register(particle);
            var angle = Math.PI * 2 * i / count + (Math.random() - 0.5) * 0.55;
            var distance = _this4.pieceSize * forceScale * (0.38 + Math.random() * 0.42);
            var target = position.clone().add3f(Math.cos(angle) * distance, Math.sin(angle) * distance, 0);
            var endScale = new Vec3(0.18 + Math.random() * 0.12, 0.18 + Math.random() * 0.12, 1);
            var duration = 0.24 + Math.random() * 0.12;
            tween(particle).parallel(tween().to(duration, {
              position: target,
              scale: endScale,
              eulerAngles: new Vec3(0, 0, 180 + Math.random() * 240)
            }, {
              easing: 'quadOut'
            }), tween(opacity).to(duration, {
              opacity: 0
            }, {
              easing: 'quadIn'
            })).call(function () {
              return _this4.transientFx.destroy(particle);
            }).start();
          };
          for (var i = 0; i < count; i++) {
            _loop();
          }
        }

        /**
         * 在炸弹中心生成短暂冲击波。
         *
         * 冲击波使用临时节点表现，大小会随本次命中的棋子数量略微变化，
         * 用来强化炸弹范围和命中反馈。
         *
         * @param position 爆炸中心位置。
         * @param strength 本次炸弹影响的棋子数量。
         */;
        _proto.spawnBombShockwave = function spawnBombShockwave(position, strength) {
          var _this5 = this;
          if (!this.transientFx.canRegister(1)) {
            return;
          }
          var shockwave = new Node('BombShockwave');
          var transform = shockwave.addComponent(UITransform);
          transform.setContentSize(this.pieceSize * 1.6, this.pieceSize * 1.6);
          var sprite = shockwave.addComponent(Sprite);
          sprite.color = new Color(255, 231, 132, 190);
          var opacity = shockwave.addComponent(UIOpacity);
          opacity.opacity = 140;
          shockwave.setParent(this.getFxLayer());
          shockwave.setPosition(position);
          shockwave.setScale(new Vec3(0.35, 0.35, 1));
          this.transientFx.register(shockwave);
          var scale = 1.2 + Math.min(strength, 9) * 0.05;
          tween(shockwave).parallel(tween().to(0.18, {
            scale: new Vec3(scale, scale, 1)
          }, {
            easing: 'quadOut'
          }), tween(opacity).to(0.18, {
            opacity: 0
          }, {
            easing: 'quadIn'
          })).call(function () {
            return _this5.transientFx.destroy(shockwave);
          }).start();
        }

        // 使用技能资源创建一次性的锤子节点，敲击结束后立即销毁，避免污染场景层级。
        ;

        _proto.createHammerSkillNode = function createHammerSkillNode(position) {
          if (!this.hammerSkillSpriteFrame) {
            return null;
          }
          var hammerNode = new Node('HammerSkillFx');
          var transform = hammerNode.addComponent(UITransform);
          // 按棋子尺寸缩放锤子贴图，保持不同棋盘尺寸下的敲击比例一致。
          transform.setContentSize(this.pieceSize * 1.05, this.pieceSize * 1.14);
          var sprite = hammerNode.addComponent(Sprite);
          sprite.spriteFrame = this.hammerSkillSpriteFrame;
          sprite.sizeMode = Sprite.SizeMode.CUSTOM;
          var fxLayer = this.getFxLayer();
          hammerNode.setParent(fxLayer);
          hammerNode.setSiblingIndex(fxLayer.children.length - 1);
          hammerNode.setPosition(position.clone().add3f(this.pieceSize * 0.32, this.pieceSize * 0.58, 0));
          hammerNode.setScale(new Vec3(0.92, 0.92, 1));
          hammerNode.setRotationFromEuler(0, 0, -28);
          return hammerNode;
        }

        // 锤子从右上方向目标棋子砸下，命中后短暂停顿，给后续碎裂动画一个清晰前摇。
        ;

        _proto.playHammerStrike = /*#__PURE__*/
        function () {
          var _playHammerStrike = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee16(position) {
            var _this6 = this;
            var hammerNode, startPosition, hitPosition;
            return _regeneratorRuntime().wrap(function _callee16$(_context16) {
              while (1) switch (_context16.prev = _context16.next) {
                case 0:
                  hammerNode = this.createHammerSkillNode(position);
                  if (hammerNode) {
                    _context16.next = 3;
                    break;
                  }
                  return _context16.abrupt("return");
                case 3:
                  startPosition = hammerNode.position.clone();
                  hitPosition = position.clone().add3f(this.pieceSize * 0.08, this.pieceSize * 0.12, 0);
                  _context16.next = 7;
                  return new Promise(function (resolve) {
                    Tween.stopAllByTarget(hammerNode);
                    tween(hammerNode).sequence(tween().to(0.08, {
                      position: startPosition.clone().add3f(_this6.pieceSize * 0.12, _this6.pieceSize * 0.16, 0),
                      scale: new Vec3(1.04, 1.04, 1),
                      eulerAngles: new Vec3(0, 0, -42)
                    }, {
                      easing: 'quadOut'
                    }), tween().to(0.09, {
                      position: hitPosition,
                      scale: new Vec3(1.18, 1.18, 1),
                      eulerAngles: new Vec3(0, 0, 18)
                    }, {
                      easing: 'quadIn'
                    }), tween().to(0.06, {
                      position: hitPosition.clone().add3f(0, _this6.pieceSize * 0.06, 0),
                      scale: Vec3.ONE,
                      eulerAngles: new Vec3(0, 0, 4)
                    }, {
                      easing: 'backOut'
                    })).call(function () {
                      hammerNode.destroy();
                      resolve();
                    }).start();
                  });
                case 7:
                case "end":
                  return _context16.stop();
              }
            }, _callee16, this);
          }));
          function playHammerStrike(_x21) {
            return _playHammerStrike.apply(this, arguments);
          }
          return playHammerStrike;
        }()
        /**
         * 围绕刚落地的棋子执行定向连锁合并。
         *
         * 与全盘扫描不同，这里始终以当前连锁锚点为起点，只处理它所在的同值连通块。
         * 如果合并后产生了新的锚点，会继续向上检查，保证“刚落下的棋子继续升级”的手感。
         *
         * @param anchor 刚落地或上一轮连锁产生的锚点棋子。
         * @returns 本轮连锁最终保留下来的锚点，以及是否发生过棋盘变化。
         */;

        _proto.resolveLandingChain = /*#__PURE__*/
        function () {
          var _resolveLandingChain = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee17(anchor) {
            var currentAnchor, changed, chainDepth, mergeResult;
            return _regeneratorRuntime().wrap(function _callee17$(_context17) {
              while (1) switch (_context17.prev = _context17.next) {
                case 0:
                  currentAnchor = anchor;
                  changed = false;
                  chainDepth = 1;
                case 3:
                  if (!currentAnchor) {
                    _context17.next = 15;
                    break;
                  }
                  _context17.next = 6;
                  return this.mergeLandingComponent(currentAnchor, chainDepth);
                case 6:
                  mergeResult = _context17.sent;
                  if (!mergeResult.anchor) {
                    _context17.next = 12;
                    break;
                  }
                  currentAnchor = mergeResult.anchor;
                  changed = true;
                  chainDepth += 1;
                  return _context17.abrupt("continue", 3);
                case 12:
                  return _context17.abrupt("break", 15);
                case 15:
                  return _context17.abrupt("return", {
                    anchor: currentAnchor,
                    changed: changed
                  });
                case 16:
                case "end":
                  return _context17.stop();
              }
            }, _callee17, this);
          }));
          function resolveLandingChain(_x22) {
            return _resolveLandingChain.apply(this, arguments);
          }
          return resolveLandingChain;
        }()
        /**
         * 扫描全盘并收集所有可合并的同值连通块。
         *
         * 使用 BFS/DFS 收集四向连通组件，长度大于 1 的组件会转成待合并组。
         * 当传入 preferredAnchor 时，所在组件会优先以它作为保留棋子，减少连锁结算的跳动感。
         *
         * @param preferredAnchor 当前结算流程希望优先保留的锚点棋子。
         * @returns 所有待播放合并动画的合并组。
         */;

        _proto.findMergeGroups = function findMergeGroups(preferredAnchor) {
          var _this7 = this;
          var visited = Array.from({
            length: this.boardheight
          }, function () {
            return Array.from({
              length: _this7.boardwidth
            }, function () {
              return false;
            });
          });
          var groups = [];
          for (var row = 0; row < this.boardheight; row++) {
            for (var column = 0; column < this.boardwidth; column++) {
              var piece = this.board[row][column];
              if (!piece || visited[row][column]) {
                continue;
              }
              var component = this.collectComponent(row, column, visited);
              if (component.length <= 1) {
                continue;
              }
              var anchorPos = this.chooseAnchor(component, preferredAnchor);
              var anchor = this.board[anchorPos.row][anchorPos.column];
              if (!anchor) {
                continue;
              }
              groups.push({
                value: anchor.getValue(),
                anchor: anchor,
                anchorPos: anchorPos,
                members: component.map(function (pos) {
                  return _this7.board[pos.row][pos.column];
                }).filter(Boolean)
              });
            }
          }
          groups.sort(function (a, b) {
            if (a.anchor === preferredAnchor) {
              return -1;
            }
            if (b.anchor === preferredAnchor) {
              return 1;
            }
            if (a.anchorPos.row !== b.anchorPos.row) {
              return a.anchorPos.row - b.anchorPos.row;
            }
            return a.anchorPos.column - b.anchorPos.column;
          });
          return groups;
        }

        // 通过广度优先搜索收集一个连通块，连通规则只看上下左右四个方向。
        ;

        _proto.collectComponent = function collectComponent(startRow, startColumn, visited) {
          var startPiece = this.board[startRow][startColumn];
          if (!startPiece) {
            return [];
          }
          var targetValue = startPiece.getValue();
          var queue = [{
            row: startRow,
            column: startColumn
          }];
          var component = [];
          visited[startRow][startColumn] = true;
          while (queue.length > 0) {
            var current = queue.shift();
            component.push(current);
            var neighbors = [{
              row: current.row - 1,
              column: current.column
            }, {
              row: current.row + 1,
              column: current.column
            }, {
              row: current.row,
              column: current.column - 1
            }, {
              row: current.row,
              column: current.column + 1
            }];
            for (var _i = 0, _neighbors = neighbors; _i < _neighbors.length; _i++) {
              var neighbor = _neighbors[_i];
              if (!this.isInsideBoard(neighbor.row, neighbor.column) || visited[neighbor.row][neighbor.column]) {
                continue;
              }
              var neighborPiece = this.board[neighbor.row][neighbor.column];
              if (!neighborPiece || neighborPiece.getValue() !== targetValue) {
                continue;
              }
              visited[neighbor.row][neighbor.column] = true;
              queue.push(neighbor);
            }
          }
          return component;
        }

        // 落地后先快速预判当前棋子是否会直接形成连通消除，用来决定先播碰撞还是消除音。
        ;

        _proto.canPieceMergeNow = function canPieceMergeNow(piece) {
          var _this8 = this;
          var piecePos = this.findPiece(piece);
          if (!piecePos) {
            return false;
          }
          var visited = Array.from({
            length: this.boardheight
          }, function () {
            return Array.from({
              length: _this8.boardwidth
            }, function () {
              return false;
            });
          });
          return this.collectComponent(piecePos.row, piecePos.column, visited).length > 1;
        }

        // 按规则决定整组保留哪颗棋子作为锚点，其他棋子都会原地消除。
        ;

        _proto.chooseAnchor = function chooseAnchor(component, preferredAnchor) {
          var _this9 = this;
          if (preferredAnchor) {
            var preferredPos = this.findPiece(preferredAnchor);
            if (preferredPos && component.some(function (pos) {
              return pos.row === preferredPos.row && pos.column === preferredPos.column;
            })) {
              return preferredPos;
            }
          }
          return component.reduce(function (best, current) {
            if (current.row < best.row) {
              return current;
            }
            if (current.row > best.row) {
              return best;
            }
            var center = (_this9.boardwidth - 1) / 2;
            var currentDistance = Math.abs(current.column - center);
            var bestDistance = Math.abs(best.column - center);
            if (currentDistance < bestDistance) {
              return current;
            }
            if (currentDistance > bestDistance) {
              return best;
            }
            return current.column < best.column ? current : best;
          });
        }
        // 并发播放当前批次的所有合并动画，等全部完成后再进入下一轮结算。
        ;

        _proto.playMergeGroups = /*#__PURE__*/
        function () {
          var _playMergeGroups = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee18(groups, chainDepth) {
            var _this10 = this;
            var animations, rewards, consumedGroups, _loop2, _iterator2, _step2, _i2, _consumedGroups, consumed, _iterator3, _step3, piece, piecePos;
            return _regeneratorRuntime().wrap(function _callee18$(_context19) {
              while (1) switch (_context19.prev = _context19.next) {
                case 0:
                  animations = [];
                  rewards = [];
                  consumedGroups = [];
                  _loop2 = /*#__PURE__*/_regeneratorRuntime().mark(function _loop2() {
                    var group, anchorPosition, consumed, nextValue;
                    return _regeneratorRuntime().wrap(function _loop2$(_context18) {
                      while (1) switch (_context18.prev = _context18.next) {
                        case 0:
                          group = _step2.value;
                          anchorPosition = _this10.getCellPosition(group.anchorPos.row, group.anchorPos.column);
                          consumed = group.members.filter(function (piece) {
                            return piece !== group.anchor;
                          });
                          nextValue = group.value * Math.pow(2, consumed.length); // 奖励分在合并动画开始前就结算，让总分数字可以连续滚动，不会等动画播完再跳第二次。
                          rewards.push(_this10.scoreManager.buildMergeReward(nextValue, consumed.length, chainDepth));
                          consumedGroups.push(consumed);
                          animations.push(_this10.animateMergeGroup(group.anchor, anchorPosition, consumed, nextValue, animations.length === 0));
                        case 7:
                        case "end":
                          return _context18.stop();
                      }
                    }, _loop2);
                  });
                  _iterator2 = _createForOfIteratorHelperLoose(groups);
                case 5:
                  if ((_step2 = _iterator2()).done) {
                    _context19.next = 9;
                    break;
                  }
                  return _context19.delegateYield(_loop2(), "t0", 7);
                case 7:
                  _context19.next = 5;
                  break;
                case 9:
                  this.applyScoreRewards(rewards);
                  _context19.next = 12;
                  return Promise.all(animations);
                case 12:
                  // 动画播完后再真正从棋盘数据里移除被消除的棋子，保证结算前后的棋盘总和一致。
                  for (_i2 = 0, _consumedGroups = consumedGroups; _i2 < _consumedGroups.length; _i2++) {
                    consumed = _consumedGroups[_i2];
                    for (_iterator3 = _createForOfIteratorHelperLoose(consumed); !(_step3 = _iterator3()).done;) {
                      piece = _step3.value;
                      piecePos = this.findPiece(piece);
                      if (piecePos) {
                        this.board[piecePos.row][piecePos.column] = null;
                      }
                    }
                  }
                case 13:
                case "end":
                  return _context19.stop();
              }
            }, _callee18, this);
          }));
          function playMergeGroups(_x23, _x24) {
            return _playMergeGroups.apply(this, arguments);
          }
          return playMergeGroups;
        }()
        /**
         * 合并落地点所在的同值连通块。
         *
         * 这个方法只处理 anchorPiece 当前所在组件，不扫描全盘。
         * 合并锚点固定为当前落地或连锁升级的棋子，其余同值成员原地消除后从棋盘数组移除。
         * 这样视觉上始终是“当前棋子匹配附近棋子，然后当前棋子升级”。
         *
         * @param anchorPiece 当前落地连锁的起点棋子。
         * @param chainDepth 当前连锁深度，用于计算奖励分和动画强度。
         * @returns 合并后保留的锚点，以及本轮是否改变棋盘。
         */;

        _proto.mergeLandingComponent = /*#__PURE__*/
        function () {
          var _mergeLandingComponent = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee19(anchorPiece, chainDepth) {
            var _this11 = this;
            var anchorPos, visited, component, mergeAnchorPos, mergeAnchor, consumed, affectedColumns, _iterator4, _step4, pos, _piece2, nextValue, _i3, _consumed, piece, piecePos;
            return _regeneratorRuntime().wrap(function _callee19$(_context20) {
              while (1) switch (_context20.prev = _context20.next) {
                case 0:
                  anchorPos = this.findPiece(anchorPiece);
                  if (anchorPos) {
                    _context20.next = 3;
                    break;
                  }
                  return _context20.abrupt("return", {
                    anchor: null,
                    changed: false
                  });
                case 3:
                  visited = Array.from({
                    length: this.boardheight
                  }, function () {
                    return Array.from({
                      length: _this11.boardwidth
                    }, function () {
                      return false;
                    });
                  });
                  component = this.collectComponent(anchorPos.row, anchorPos.column, visited);
                  if (!(component.length <= 1)) {
                    _context20.next = 7;
                    break;
                  }
                  return _context20.abrupt("return", {
                    anchor: null,
                    changed: false
                  });
                case 7:
                  mergeAnchorPos = anchorPos;
                  mergeAnchor = this.board[mergeAnchorPos.row][mergeAnchorPos.column];
                  if (mergeAnchor) {
                    _context20.next = 11;
                    break;
                  }
                  return _context20.abrupt("return", {
                    anchor: null,
                    changed: false
                  });
                case 11:
                  consumed = [];
                  affectedColumns = new Set();
                  _iterator4 = _createForOfIteratorHelperLoose(component);
                case 14:
                  if ((_step4 = _iterator4()).done) {
                    _context20.next = 25;
                    break;
                  }
                  pos = _step4.value;
                  affectedColumns.add(pos.column);
                  if (!(pos.row === mergeAnchorPos.row && pos.column === mergeAnchorPos.column)) {
                    _context20.next = 19;
                    break;
                  }
                  return _context20.abrupt("continue", 23);
                case 19:
                  _piece2 = this.board[pos.row][pos.column];
                  if (_piece2) {
                    _context20.next = 22;
                    break;
                  }
                  return _context20.abrupt("continue", 23);
                case 22:
                  consumed.push(_piece2);
                case 23:
                  _context20.next = 14;
                  break;
                case 25:
                  nextValue = mergeAnchor.getValue() * Math.pow(2, consumed.length); // 落地连锁的奖励分同样提前结算，避免分数先停住再补播一次消除加分。
                  this.applyScoreRewards([this.scoreManager.buildMergeReward(nextValue, consumed.length, chainDepth)]);
                  _context20.next = 29;
                  return this.animateDirectedMerge(mergeAnchor, this.getCellPosition(mergeAnchorPos.row, mergeAnchorPos.column), consumed, nextValue, true);
                case 29:
                  // 动画结束后再清理被消除的棋子引用，后续重力和二次结算才能拿到稳定棋盘。
                  for (_i3 = 0, _consumed = consumed; _i3 < _consumed.length; _i3++) {
                    piece = _consumed[_i3];
                    piecePos = this.findPiece(piece);
                    if (piecePos) {
                      this.board[piecePos.row][piecePos.column] = null;
                    }
                  }
                  _context20.next = 32;
                  return this.applyGravityColumns([].concat(affectedColumns));
                case 32:
                  return _context20.abrupt("return", {
                    anchor: mergeAnchor,
                    changed: true
                  });
                case 33:
                case "end":
                  return _context20.stop();
              }
            }, _callee19, this);
          }));
          function mergeLandingComponent(_x25, _x26) {
            return _mergeLandingComponent.apply(this, arguments);
          }
          return mergeLandingComponent;
        }() // 单个合并组的动画封装，底层复用定向消除并升级的表现逻辑。
        ;

        _proto.animateMergeGroup = /*#__PURE__*/
        function () {
          var _animateMergeGroup = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee20(anchor, anchorPosition, consumed, nextValue, shouldPlayMergeSound) {
            return _regeneratorRuntime().wrap(function _callee20$(_context21) {
              while (1) switch (_context21.prev = _context21.next) {
                case 0:
                  if (shouldPlayMergeSound === void 0) {
                    shouldPlayMergeSound = false;
                  }
                  _context21.next = 3;
                  return this.animateDirectedMerge(anchor, anchorPosition, consumed, nextValue, shouldPlayMergeSound);
                case 3:
                case "end":
                  return _context21.stop();
              }
            }, _callee20, this);
          }));
          function animateMergeGroup(_x27, _x28, _x29, _x30, _x31) {
            return _animateMergeGroup.apply(this, arguments);
          }
          return animateMergeGroup;
        }()
        /**
         * 对整张棋盘应用重力下落。
         *
         * 每列从底部开始写入非空棋子，清除中间空洞，并为移动过的棋子播放下落动画。
         * 返回值用于 settleBoard 判断是否需要继续扫描新形成的合并组。
         *
         * @returns 是否有任何棋子发生了位置移动。
         */;

        _proto.applyGravityAllColumns = /*#__PURE__*/
        function () {
          var _applyGravityAllColumns = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee21() {
            var animations, moved, column, writeRow, row, piece, _row;
            return _regeneratorRuntime().wrap(function _callee21$(_context22) {
              while (1) switch (_context22.prev = _context22.next) {
                case 0:
                  animations = [];
                  moved = false;
                  column = 0;
                case 3:
                  if (!(column < this.boardwidth)) {
                    _context22.next = 19;
                    break;
                  }
                  writeRow = 0;
                  row = 0;
                case 6:
                  if (!(row < this.boardheight)) {
                    _context22.next = 15;
                    break;
                  }
                  piece = this.board[row][column];
                  if (piece) {
                    _context22.next = 10;
                    break;
                  }
                  return _context22.abrupt("continue", 12);
                case 10:
                  if (writeRow !== row) {
                    this.board[writeRow][column] = piece;
                    this.board[row][column] = null;
                    animations.push(this.animateMove(piece.node, this.getCellPosition(writeRow, column), 0.12));
                    moved = true;
                  }
                  writeRow += 1;
                case 12:
                  row++;
                  _context22.next = 6;
                  break;
                case 15:
                  for (_row = writeRow; _row < this.boardheight; _row++) {
                    this.board[_row][column] = null;
                  }
                case 16:
                  column++;
                  _context22.next = 3;
                  break;
                case 19:
                  if (!(animations.length > 0)) {
                    _context22.next = 22;
                    break;
                  }
                  _context22.next = 22;
                  return Promise.all(animations);
                case 22:
                  return _context22.abrupt("return", moved);
                case 23:
                case "end":
                  return _context22.stop();
              }
            }, _callee21, this);
          }));
          function applyGravityAllColumns() {
            return _applyGravityAllColumns.apply(this, arguments);
          }
          return applyGravityAllColumns;
        }()
        /**
         * 只对指定列应用重力下落。
         *
         * 技能消除或落地点局部合并后，只有部分列会出现空洞。
         * 这里先去重并过滤非法列，再逐列压缩棋子，减少不必要的全盘动画。
         *
         * @param columns 需要重新压缩的列索引集合。
         * @returns 是否有任何棋子发生了位置移动。
         */;

        _proto.applyGravityColumns = /*#__PURE__*/
        function () {
          var _applyGravityColumns = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee22(columns) {
            var _this12 = this;
            var uniqueColumns, animations, moved, _iterator5, _step5, column, writeRow, row, piece, _row2;
            return _regeneratorRuntime().wrap(function _callee22$(_context23) {
              while (1) switch (_context23.prev = _context23.next) {
                case 0:
                  uniqueColumns = [].concat(new Set(columns)).filter(function (column) {
                    return column >= 0 && column < _this12.boardwidth;
                  });
                  if (!(uniqueColumns.length === 0)) {
                    _context23.next = 3;
                    break;
                  }
                  return _context23.abrupt("return", false);
                case 3:
                  animations = [];
                  moved = false;
                  _iterator5 = _createForOfIteratorHelperLoose(uniqueColumns);
                case 6:
                  if ((_step5 = _iterator5()).done) {
                    _context23.next = 22;
                    break;
                  }
                  column = _step5.value;
                  writeRow = 0;
                  row = 0;
                case 10:
                  if (!(row < this.boardheight)) {
                    _context23.next = 19;
                    break;
                  }
                  piece = this.board[row][column];
                  if (piece) {
                    _context23.next = 14;
                    break;
                  }
                  return _context23.abrupt("continue", 16);
                case 14:
                  if (writeRow !== row) {
                    this.board[writeRow][column] = piece;
                    this.board[row][column] = null;
                    animations.push(this.animateMove(piece.node, this.getCellPosition(writeRow, column), 0.12));
                    moved = true;
                  }
                  writeRow += 1;
                case 16:
                  row++;
                  _context23.next = 10;
                  break;
                case 19:
                  for (_row2 = writeRow; _row2 < this.boardheight; _row2++) {
                    this.board[_row2][column] = null;
                  }
                case 20:
                  _context23.next = 6;
                  break;
                case 22:
                  if (!(animations.length > 0)) {
                    _context23.next = 25;
                    break;
                  }
                  _context23.next = 25;
                  return Promise.all(animations);
                case 25:
                  return _context23.abrupt("return", moved);
                case 26:
                case "end":
                  return _context23.stop();
              }
            }, _callee22, this);
          }));
          function applyGravityColumns(_x32) {
            return _applyGravityColumns.apply(this, arguments);
          }
          return applyGravityColumns;
        }()
        /**
         * 用统一缓动把节点移动到目标格子。
         *
         * 落子、重力和局部结算都复用这套移动节奏，调用前会先停止目标节点旧 Tween，
         * 避免同一棋子同时被多个动画驱动。
         *
         * @param node 需要移动的节点。
         * @param position 目标本地坐标。
         * @param duration 期望动画时长，会被限制到较短范围以保持结算节奏。
         */;

        _proto.animateMove = function animateMove(node, position, duration) {
          Tween.stopAllByTarget(node);
          return new Promise(function (resolve) {
            tween(node).to(Math.min(duration, 0.09), {
              position: position
            }, {
              easing: 'quadOut'
            }).call(resolve).start();
          });
        }
        /**
         * 执行一次完整的定向消除表现。
         *
         * 所有被消除棋子留在原格播放破碎淡出，随后锚点升级数值，
         * 再播放闪光、爆裂和轻微回弹，形成“消除附近棋子后当前棋子升级”的反馈。
         *
         * @param anchor 合并后保留并升级的棋子。
         * @param anchorPosition 锚点所在的目标坐标。
         * @param consumed 会被原地消除并销毁的棋子列表。
         * @param nextValue 合并后锚点的新数值。
         * @param shouldPlayMergeSound 是否在升级爆点帧播放本组合并音效。
         */;
        _proto.animateDirectedMerge = /*#__PURE__*/
        function () {
          var _animateDirectedMerge = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee23(anchor, anchorPosition, consumed, nextValue, shouldPlayMergeSound) {
            var _this13 = this;
            var consumedAnimations, upgradeAnimation;
            return _regeneratorRuntime().wrap(function _callee23$(_context24) {
              while (1) switch (_context24.prev = _context24.next) {
                case 0:
                  if (shouldPlayMergeSound === void 0) {
                    shouldPlayMergeSound = false;
                  }
                  anchor.node.setPosition(anchorPosition);
                  consumedAnimations = consumed.map(function (piece, index) {
                    return _this13.animateConsumedPieceClear(piece, index);
                  }); // 升级不再等待周围棋子完全消失，避免“消除结束后停一下再弹”的顿挫。
                  _context24.next = 5;
                  return this.waitSeconds(0.1);
                case 5:
                  if (!shouldPlayMergeSound) {
                    _context24.next = 8;
                    break;
                  }
                  _context24.next = 8;
                  return this.playMergeSoundWithGap();
                case 8:
                  upgradeAnimation = this.animateAnchorUpgrade(anchor, anchorPosition, nextValue, consumed.length);
                  _context24.next = 11;
                  return Promise.all([upgradeAnimation].concat(consumedAnimations));
                case 11:
                case "end":
                  return _context24.stop();
              }
            }, _callee23, this);
          }));
          function animateDirectedMerge(_x33, _x34, _x35, _x36, _x37) {
            return _animateDirectedMerge.apply(this, arguments);
          }
          return animateDirectedMerge;
        }()
        /**
         * 播放被消除棋子的原地碎裂动画。
         *
         * 周围棋子只做短促但柔和的原地淡出，重点让位给后续当前棋子的爆点升级。
         * 微小错帧用于避免多颗棋子完全同帧消失造成视觉卡顿，但不再形成机械的逐个队列。
         *
         * @param piece 即将从棋盘中移除的棋子。
         * @param clearIndex 本轮组内的消除顺序，用于制造轻微错帧。
         */;

        _proto.animateConsumedPieceClear = function animateConsumedPieceClear(piece, clearIndex) {
          var _node$getComponent3,
            _this14 = this;
          var node = piece.node;
          var origin = node.position.clone();
          var opacity = (_node$getComponent3 = node.getComponent(UIOpacity)) != null ? _node$getComponent3 : node.addComponent(UIOpacity);
          var delay = Math.min(clearIndex, 3) * 0.012;
          var endPosition = origin.clone().add3f(0, this.pieceSize * 0.025, 0);
          opacity.opacity = 255;
          node.setPosition(origin);
          return new Promise(function (resolve) {
            Tween.stopAllByTarget(node);
            Tween.stopAllByTarget(opacity);
            tween(node).sequence(tween().delay(delay), tween().to(0.055, {
              scale: new Vec3(1.04, 1.04, 1)
            }, {
              easing: 'sineOut'
            }), tween().call(function () {
              return _this14.spawnSkillShatterParticles(piece, origin, 3, 0.24);
            }), tween().parallel(tween().to(0.18, {
              position: endPosition,
              scale: new Vec3(0.62, 0.62, 1)
            }, {
              easing: 'sineInOut'
            }), tween(opacity).to(0.18, {
              opacity: 0
            }, {
              easing: 'sineInOut'
            }))).call(function () {
              node.destroy();
              resolve();
            }).start();
          });
        }

        /**
         * 播放保留棋子的升级反馈。
         *
         * 周围棋子淡出过程中，当前棋子直接切换数值并舒展弹回。
         * 爆点、碎片和棋子弹跳放在同一时间窗口里，减少串行动画造成的停顿。
         *
         * @param anchor 合并后保留并升级的棋子。
         * @param anchorPosition 锚点所在的目标坐标。
         * @param nextValue 合并后的新数值。
         * @param strength 本次被消除的棋子数量。
         */;
        _proto.animateAnchorUpgrade = /*#__PURE__*/
        function () {
          var _animateAnchorUpgrade = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee24(anchor, anchorPosition, nextValue, strength) {
            return _regeneratorRuntime().wrap(function _callee24$(_context25) {
              while (1) switch (_context25.prev = _context25.next) {
                case 0:
                  anchor.node.setPosition(anchorPosition);
                  anchor.setValue(nextValue);
                  this.scoreManager.updateHighestPieceValue(nextValue);
                  this.spawnUpgradeImpact(anchor, anchorPosition, strength);
                  this.spawnMergeFlash(anchor, anchorPosition, strength);
                  this.spawnMergeBurst(anchor, anchorPosition, strength);
                  _context25.next = 8;
                  return new Promise(function (resolve) {
                    Tween.stopAllByTarget(anchor.node);
                    tween(anchor.node).sequence(tween().to(0.13, {
                      scale: new Vec3(1.1, 1.1, 1)
                    }, {
                      easing: 'sineOut'
                    }), tween().to(0.115, {
                      scale: new Vec3(0.995, 0.995, 1)
                    }, {
                      easing: 'sineInOut'
                    }), tween().to(0.065, {
                      scale: Vec3.ONE
                    }, {
                      easing: 'sineOut'
                    })).call(resolve).start();
                  });
                case 8:
                case "end":
                  return _context25.stop();
              }
            }, _callee24, this);
          }));
          function animateAnchorUpgrade(_x38, _x39, _x40, _x41) {
            return _animateAnchorUpgrade.apply(this, arguments);
          }
          return animateAnchorUpgrade;
        }() // 等待短时间片，用于把消除和升级安排在同一条时间轴上，减少串行动画的停顿感。
        ;

        _proto.waitSeconds = function waitSeconds(duration) {
          var _this15 = this;
          return new Promise(function (resolve) {
            _this15.scheduleOnce(function () {
              return resolve();
            }, duration);
          });
        }

        /**
         * 在当前棋子位置生成升级爆点。
         *
         * 爆点使用锚点棋子的外观快速放大淡出，作为数值升级瞬间的主视觉。
         * 它和普通碎片、闪光叠加，但只在当前棋子位置出现，避免又变回“其他棋子飞来合成”的感觉。
         *
         * @param anchor 提供贴图和颜色参考的当前棋子。
         * @param position 爆点中心位置。
         * @param strength 本次消除数量，用来轻微放大爆点规模。
         */;
        _proto.spawnUpgradeImpact = function spawnUpgradeImpact(anchor, position, strength) {
          var _this16 = this;
          if (!this.transientFx.canRegister(1)) {
            return;
          }
          var impact = this.createFxPiece(anchor);
          var opacity = impact.addComponent(UIOpacity);
          opacity.opacity = 150;
          var fxLayer = this.getFxLayer();
          impact.setParent(fxLayer);
          impact.setSiblingIndex(fxLayer.children.length - 1);
          impact.setPosition(position);
          impact.setScale(new Vec3(0.58, 0.58, 1));
          var sprite = impact.getComponent(Sprite);
          if (sprite) {
            sprite.color = new Color(255, 246, 176, 255);
          }
          this.transientFx.register(impact);
          var targetScale = 1.34 + Math.min(strength, 4) * 0.08;
          tween(impact).parallel(tween().to(0.26, {
            scale: new Vec3(targetScale, targetScale, 1)
          }, {
            easing: 'sineOut'
          }), tween(opacity).to(0.26, {
            opacity: 0
          }, {
            easing: 'sineOut'
          })).call(function () {
            return _this16.transientFx.destroy(impact);
          }).start();
        }

        /**
         * 在合并锚点位置生成短暂闪光。
         *
         * 闪光复用棋子贴图并快速放大淡出，用来强调升级瞬间；
         * strength 会轻微影响放大幅度，但仍受特效数量上限约束。
         *
         * @param anchor 提供贴图和颜色参考的锚点棋子。
         * @param position 闪光出现的位置。
         * @param strength 本次合并强度，通常与被消除棋子数量相关。
         */;
        _proto.spawnMergeFlash = function spawnMergeFlash(anchor, position, strength) {
          var _this17 = this;
          if (!this.transientFx.canRegister(1)) {
            return;
          }
          var flash = this.createFxPiece(anchor);
          var opacity = flash.addComponent(UIOpacity);
          opacity.opacity = 88;
          flash.setParent(this.getFxLayer());
          flash.setPosition(position);
          flash.setScale(new Vec3(0.82, 0.82, 1));
          var sprite = flash.getComponent(Sprite);
          if (sprite) {
            sprite.color = new Color(255, 248, 214, 255);
          }
          this.transientFx.register(flash);
          var targetScale = 1.08 + Math.min(strength, 2) * 0.05;
          tween(flash).parallel(tween().to(0.22, {
            scale: new Vec3(targetScale, targetScale, 1)
          }, {
            easing: 'sineOut'
          }), tween(opacity).to(0.22, {
            opacity: 0
          }, {
            easing: 'sineOut'
          })).call(function () {
            return _this17.transientFx.destroy(flash);
          }).start();
        }
        /**
         * 合并时从锚点向四周喷射碎片粒子。
         *
         * 粒子数量和扩散半径会随 strength 增加，用来区分普通合并和更大的连锁合并。
         * 所有粒子都会登记到 transientFx，便于暂停、返回首页或重开时统一清理。
         *
         * @param anchor 提供贴图和颜色参考的锚点棋子。
         * @param position 粒子爆发中心。
         * @param strength 本次合并强度。
         */;
        _proto.spawnMergeBurst = function spawnMergeBurst(anchor, position, strength) {
          var _this18 = this;
          var count = Math.min(3, 1 + strength);
          if (!this.transientFx.canRegister(count)) {
            return;
          }
          var radius = 28 + strength * 5;
          var _loop3 = function _loop3() {
            var particle = _this18.createFxPiece(anchor);
            var opacity = particle.addComponent(UIOpacity);
            opacity.opacity = 120;
            var transform = particle.getComponent(UITransform);
            transform == null || transform.setContentSize(14, 14);
            particle.setParent(_this18.getFxLayer());
            particle.setPosition(position);
            particle.setScale(new Vec3(0.14, 0.14, 1));
            _this18.transientFx.register(particle);
            var angle = Math.PI * 2 * i / count + Math.random() * 0.35;
            var distance = radius * (0.75 + Math.random() * 0.4);
            var target = new Vec3(position.x + Math.cos(angle) * distance, position.y + Math.sin(angle) * distance, 0);
            tween(particle).parallel(tween().to(0.24, {
              position: target,
              scale: new Vec3(0.08, 0.08, 1)
            }, {
              easing: 'sineOut'
            }), tween(opacity).to(0.24, {
              opacity: 0
            }, {
              easing: 'sineOut'
            })).call(function () {
              return _this18.transientFx.destroy(particle);
            }).start();
          };
          for (var i = 0; i < count; i++) {
            _loop3();
          }
        }

        // 创建一个用于特效表现的临时棋子节点，复用原棋子的颜色与外观。
        ;

        _proto.createFxPiece = function createFxPiece(source) {
          var node = new Node('FxPiece');
          var transform = node.addComponent(UITransform);
          transform.setContentSize(this.pieceSize, this.pieceSize);
          var sprite = node.addComponent(Sprite);
          sprite.sizeMode = Sprite.SizeMode.CUSTOM;
          sprite.spriteFrame = source.getSpriteFrame();
          sprite.color = source.getBackgroundColor();
          return node;
        }

        // 在棋盘数组里查找某颗棋子当前所在的行列坐标。
        ;

        _proto.findPiece = function findPiece(target) {
          return this.boardModel.findPiece(this.board, this.boardheight, this.boardwidth, target);
        }

        // 判断给定的行列是否仍处在棋盘合法范围内。
        ;

        _proto.isInsideBoard = function isInsideBoard(row, column) {
          var _this$boardGeometry$i, _this$boardGeometry;
          return (_this$boardGeometry$i = (_this$boardGeometry = this.boardGeometry) == null ? void 0 : _this$boardGeometry.isInsideBoard(row, column)) != null ? _this$boardGeometry$i : false;
        }
        // 检查每列是否已满
        ;

        _proto.isBoardFull = function isBoardFull() {
          return this.boardModel.isBoardFull(this.board, this.boardheight, this.boardwidth);
        }
        // 返回某列第一个空行
        ;

        _proto.getDropRow = function getDropRow(column) {
          return this.boardModel.getDropRow(this.board, this.boardheight, column);
        }
        // 找到离目标列最近的可用列
        ;

        _proto.getNearestAvailableColumn = function getNearestAvailableColumn(preferredColumn) {
          return this.boardModel.getNearestAvailableColumn(this.board, this.boardheight, this.boardwidth, preferredColumn);
        }

        // 触摸列换算已交给 BoardGeometry，这里只保持旧调用入口。
        ;

        _proto.getColumnFromTouch = function getColumnFromTouch(event) {
          var _this$boardGeometry$g, _this$boardGeometry2;
          this.syncBoardGeometryOptions();
          return (_this$boardGeometry$g = (_this$boardGeometry2 = this.boardGeometry) == null ? void 0 : _this$boardGeometry2.getColumnFromTouch(event)) != null ? _this$boardGeometry$g : -1;
        }

        // 触摸格子换算已交给 BoardGeometry，这里只保持旧调用入口。
        ;

        _proto.getCellFromTouch = function getCellFromTouch(event) {
          var _this$boardGeometry$g2, _this$boardGeometry3;
          this.syncBoardGeometryOptions();
          return (_this$boardGeometry$g2 = (_this$boardGeometry3 = this.boardGeometry) == null ? void 0 : _this$boardGeometry3.getCellFromTouch(event)) != null ? _this$boardGeometry$g2 : null;
        }

        // Cocos 触摸坐标先从 UI 坐标转成本节点坐标，所有棋盘操作都基于同一坐标系。
        ;

        _proto.getLocalPositionFromTouch = function getLocalPositionFromTouch(event) {
          var _this$boardGeometry$g3, _this$boardGeometry4;
          this.syncBoardGeometryOptions();
          return (_this$boardGeometry$g3 = (_this$boardGeometry4 = this.boardGeometry) == null ? void 0 : _this$boardGeometry4.getLocalPositionFromTouch(event)) != null ? _this$boardGeometry$g3 : null;
        }

        // 使用棋盘节点的世界包围盒判断触摸是否真的落在棋盘区域内。
        ;

        _proto.isTouchInsideBoard = function isTouchInsideBoard(x, y) {
          var _this$boardGeometry$i2, _this$boardGeometry5;
          return (_this$boardGeometry$i2 = (_this$boardGeometry5 = this.boardGeometry) == null ? void 0 : _this$boardGeometry5.isTouchInsideBoard(x, y)) != null ? _this$boardGeometry$i2 : false;
        }
        // 格子坐标换算已交给 BoardGeometry，这里只保持旧调用入口。
        ;

        _proto.getCellPosition = function getCellPosition(row, column) {
          var _this$boardGeometry$g4, _this$boardGeometry6;
          this.syncBoardGeometryOptions();
          return (_this$boardGeometry$g4 = (_this$boardGeometry6 = this.boardGeometry) == null ? void 0 : _this$boardGeometry6.getCellPosition(row, column)) != null ? _this$boardGeometry$g4 : new Vec3();
        }
        // 出生点换算已交给 BoardGeometry，这里只保持旧调用入口。
        ;

        _proto.getSpawnPosition = function getSpawnPosition(column) {
          var _this$boardGeometry$g5, _this$boardGeometry7;
          this.syncBoardGeometryOptions();
          return (_this$boardGeometry$g5 = (_this$boardGeometry7 = this.boardGeometry) == null ? void 0 : _this$boardGeometry7.getSpawnPosition(column)) != null ? _this$boardGeometry$g5 : new Vec3();
        }

        // 单格步长 = 棋子尺寸 + 列间距，这是所有坐标换算的基础。
        ;

        _proto.getStepSize = function getStepSize() {
          var _this$boardGeometry$g6, _this$boardGeometry8;
          this.syncBoardGeometryOptions();
          return (_this$boardGeometry$g6 = (_this$boardGeometry8 = this.boardGeometry) == null ? void 0 : _this$boardGeometry8.getStepSize()) != null ? _this$boardGeometry$g6 : this.pieceSize + this.spacing;
        }

        // 把 PlayController 上的可调参数同步给几何模块，兼容编辑器里继续改属性。
        ;

        _proto.syncBoardGeometryOptions = function syncBoardGeometryOptions() {
          var _this$boardGeometry9;
          (_this$boardGeometry9 = this.boardGeometry) == null || _this$boardGeometry9.updateOptions(this.buildBoardGeometryOptions());
        }

        // 几何模块只接收必要参数，避免直接读取玩法控制器内部状态。
        ;

        _proto.buildBoardGeometryOptions = function buildBoardGeometryOptions() {
          return {
            boardWidth: this.boardwidth,
            boardHeight: this.boardheight,
            pieceSize: this.pieceSize,
            spacing: this.spacing,
            spawnOffsetY: this.spawnOffsetY
          };
        }

        // 把当前玩法状态统一推送给 UI 组件，避免逻辑层分别操作多个界面节点。
        ;

        _proto.refreshUiState = function refreshUiState() {
          var _this$uiController2;
          (_this$uiController2 = this.uiController) == null || _this$uiController2.renderState(this.buildUiState());
        }

        // 逻辑层只暴露一份纯数据状态给 UI 层，保证职责边界清晰。
        ;

        _proto.buildUiState = function buildUiState() {
          var _this$currentPiece$ge2, _this$currentPiece3;
          var boardScore = this.scoreManager.getBoardScore(this.board);
          var economy = this.economy.getSnapshot();
          return {
            currentValue: (_this$currentPiece$ge2 = (_this$currentPiece3 = this.currentPiece) == null ? void 0 : _this$currentPiece3.getValue()) != null ? _this$currentPiece$ge2 : null,
            nextValue: this.nextPieceValue,
            currentColumn: this.currentColumn,
            score: boardScore + this.scoreManager.getBonusScore(),
            highestValue: this.scoreManager.getHighestPieceValue(),
            gameOverCoinReward: this.gameOverCoinReward,
            isGameOver: this.isGameOver,
            isPaused: this.isPaused,
            isResolving: this.isResolving,
            activeSkill: this.isBombSkillActive ? 'bomb' : this.isHammerSkillActive ? 'hammer' : this.isSwapSkillActive ? 'swap' : null,
            coins: economy.coins,
            skillCounts: economy.skills,
            skillUsed: _extends({}, this.usedSkillsThisGame)
          };
        }

        // 奖励分累计已交给 ScoreManager，这里负责根据结果刷新 UI。
        ;

        _proto.applyScoreRewards = function applyScoreRewards(rewards) {
          if (this.scoreManager.applyScoreRewards(rewards)) {
            this.refreshUiState();
          }
        }

        // UI 层按钮点击后只通过这个入口切换暂停，真正的状态变化仍由逻辑层维护。
        ;

        _proto.togglePauseFromUi = function togglePauseFromUi() {
          if (!this.hasStartedSession) {
            return;
          }
          if (this.isResolving || this.isGameOver) {
            return;
          }
          if (this.isSwapSkillActive || this.isHammerSkillActive || this.isBombSkillActive) {
            void this.cancelActiveSkillMode();
            return;
          }
          this.isPaused = !this.isPaused;
          if (!this.isPaused) {
            this.trailTimer = 0;
          }
          this.refreshUiState();
        }

        // 暂停弹窗点击返回首页时先保存对局快照，再清理场景节点并加载首页。
        ;

        _proto.returnToStartPageFromPause = function returnToStartPageFromPause() {
          var _this19 = this;
          if (!this.hasStartedSession) {
            return;
          }
          OngoingGameSession.save(this.buildOngoingGameSnapshot());
          // 回首页只保留本次切场景任务，取消之前用于动画等待的 scheduleOnce。
          this.unscheduleAllCallbacks();
          this.clearBoardPieces();
          this.transientFx.clear();
          this.hasStartedSession = false;
          this.isGameOver = false;
          this.isFastDropping = false;
          this.isResolving = false;
          this.isPaused = false;
          this.isSwapSkillActive = false;
          this.isHammerSkillActive = false;
          this.isBombSkillActive = false;
          this.swapDragState = null;
          this.resetBoard();
          // 即将离开游戏场景，不再刷新暂停 UI，避免触摸收尾时触发弹窗关闭动画和事件解绑。
          this.scheduleOnce(function () {
            return director.loadScene(_this19.homeSceneName);
          }, 0);
        }

        // 结算弹窗点击回首页时，本局已经结束，因此不保存进行中快照，也不消耗体力。
        ;

        _proto.returnToStartPageFromGameOver = function returnToStartPageFromGameOver() {
          var _this20 = this;
          if (!this.hasStartedSession) {
            return;
          }
          OngoingGameSession.finishGame();
          // 回首页只保留本次切场景任务，取消之前用于动画等待的 scheduleOnce。
          this.unscheduleAllCallbacks();
          this.clearBoardPieces();
          this.transientFx.clear();
          this.hasStartedSession = false;
          this.isGameOver = false;
          this.isFastDropping = false;
          this.isResolving = false;
          this.isPaused = false;
          this.isSwapSkillActive = false;
          this.isHammerSkillActive = false;
          this.isBombSkillActive = false;
          this.swapDragState = null;
          this.currentPiece = null;
          this.resetBoard();
          // 没体力无法重开时，首页 icon 是结算弹窗的兜底出口。
          this.scheduleOnce(function () {
            return director.loadScene(_this20.homeSceneName);
          }, 0);
        }

        // 分享入口只负责适配平台能力；没有平台 API 时保持静默降级，避免打断暂停弹窗。
        ;

        _proto.shareGameFromPause = /*#__PURE__*/
        function () {
          var _shareGameFromPause = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee25() {
            var result, _this$uiController3, _this$uiController4;
            return _regeneratorRuntime().wrap(function _callee25$(_context26) {
              while (1) switch (_context26.prev = _context26.next) {
                case 0:
                  _context26.next = 2;
                  return this.shareAdapter.shareScore(this.scoreManager.getTotalScore(this.board), 'pause_share');
                case 2:
                  result = _context26.sent;
                  if (this.node.isValid) {
                    _context26.next = 5;
                    break;
                  }
                  return _context26.abrupt("return");
                case 5:
                  if (result === 'cancelled') {
                    (_this$uiController3 = this.uiController) == null || _this$uiController3.showTransientMessage('分享未完成');
                  } else if (result === 'unsupported') {
                    (_this$uiController4 = this.uiController) == null || _this$uiController4.showTransientMessage('当前平台暂不支持分享');
                  }
                case 6:
                case "end":
                  return _context26.stop();
              }
            }, _callee25, this);
          }));
          function shareGameFromPause() {
            return _shareGameFromPause.apply(this, arguments);
          }
          return shareGameFromPause;
        }() // 结算弹窗分享本局分数，和暂停分享共用平台适配逻辑。
        ;

        _proto.shareGameFromGameOver = /*#__PURE__*/
        function () {
          var _shareGameFromGameOver = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee26() {
            var result, _this$uiController5, _this$uiController6;
            return _regeneratorRuntime().wrap(function _callee26$(_context27) {
              while (1) switch (_context27.prev = _context27.next) {
                case 0:
                  _context27.next = 2;
                  return this.shareAdapter.shareScore(this.scoreManager.getTotalScore(this.board), 'game_over_share');
                case 2:
                  result = _context27.sent;
                  if (this.node.isValid) {
                    _context27.next = 5;
                    break;
                  }
                  return _context27.abrupt("return");
                case 5:
                  if (result === 'cancelled') {
                    (_this$uiController5 = this.uiController) == null || _this$uiController5.showTransientMessage('分享未完成');
                  } else if (result === 'unsupported') {
                    (_this$uiController6 = this.uiController) == null || _this$uiController6.showTransientMessage('当前平台暂不支持分享');
                  }
                case 6:
                case "end":
                  return _context27.stop();
              }
            }, _callee26, this);
          }));
          function shareGameFromGameOver() {
            return _shareGameFromGameOver.apply(this, arguments);
          }
          return shareGameFromGameOver;
        }() // 客服能力统一交给平台适配器；设置弹窗只派发意图，不直接依赖微信 API。
        ;

        _proto.openFeedbackFromPause = /*#__PURE__*/
        function () {
          var _openFeedbackFromPause = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee27() {
            var result, _this$uiController7, _this$uiController8;
            return _regeneratorRuntime().wrap(function _callee27$(_context28) {
              while (1) switch (_context28.prev = _context28.next) {
                case 0:
                  _context28.next = 2;
                  return this.feedbackAdapter.open('pause_feedback');
                case 2:
                  result = _context28.sent;
                  if (this.node.isValid) {
                    _context28.next = 5;
                    break;
                  }
                  return _context28.abrupt("return");
                case 5:
                  if (result === 'unsupported') {
                    (_this$uiController7 = this.uiController) == null || _this$uiController7.showTransientMessage('当前平台暂不支持客服反馈');
                  } else if (result === 'failed') {
                    (_this$uiController8 = this.uiController) == null || _this$uiController8.showTransientMessage('客服入口打开失败，请稍后重试');
                  }
                case 6:
                case "end":
                  return _context28.stop();
              }
            }, _callee27, this);
          }));
          function openFeedbackFromPause() {
            return _openFeedbackFromPause.apply(this, arguments);
          }
          return openFeedbackFromPause;
        }()
        /**
         * 游戏顶部金币 Prefab 的分享奖励入口。
         * 分享适配层只报告流程结果，每次成功分享都会由经济仓库发放并持久化金币。
         */;

        _proto.shareForCoinReward = /*#__PURE__*/
        function () {
          var _shareForCoinReward = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee28() {
            var _this$uiController12;
            var result, _this$uiController9, _this$uiController10, claim, _this$uiController11;
            return _regeneratorRuntime().wrap(function _callee28$(_context29) {
              while (1) switch (_context29.prev = _context29.next) {
                case 0:
                  _context29.next = 2;
                  return this.shareAdapter.shareReward('coins');
                case 2:
                  result = _context29.sent;
                  if (this.node.isValid) {
                    _context29.next = 5;
                    break;
                  }
                  return _context29.abrupt("return");
                case 5:
                  if (!(result === 'cancelled')) {
                    _context29.next = 8;
                    break;
                  }
                  (_this$uiController9 = this.uiController) == null || _this$uiController9.showTransientMessage('分享未完成，未发放奖励');
                  return _context29.abrupt("return");
                case 8:
                  if (!(result === 'unsupported')) {
                    _context29.next = 11;
                    break;
                  }
                  (_this$uiController10 = this.uiController) == null || _this$uiController10.showTransientMessage('当前平台暂不支持分享奖励');
                  return _context29.abrupt("return");
                case 11:
                  claim = this.economy.claimShareReward('coins');
                  if (claim.claimed) {
                    _context29.next = 15;
                    break;
                  }
                  (_this$uiController11 = this.uiController) == null || _this$uiController11.showTransientMessage('金币奖励发放失败，请稍后重试');
                  return _context29.abrupt("return");
                case 15:
                  this.refreshUiState();
                  (_this$uiController12 = this.uiController) == null || _this$uiController12.showTransientMessage("\u5206\u4EAB\u5956\u52B1\uFF1A\u91D1\u5E01 +" + claim.amount);
                case 17:
                case "end":
                  return _context29.stop();
              }
            }, _callee28, this);
          }));
          function shareForCoinReward() {
            return _shareForCoinReward.apply(this, arguments);
          }
          return shareForCoinReward;
        }() // UI 层第三技能按钮通过这个入口切换交换技能，技能态只冻结下落，不打开暂停弹窗。
        ;

        _proto.toggleSwapSkillFromUi = function toggleSwapSkillFromUi() {
          if (!this.hasStartedSession) {
            return;
          }
          if (this.isResolving || this.isGameOver || this.isPaused || !this.currentPiece || this.isHammerSkillActive || this.isBombSkillActive) {
            return;
          }
          if (this.isSwapSkillActive) {
            void this.cancelActiveSkillMode();
            return;
          }
          if (!this.ensureSkillAvailable('swap')) {
            return;
          }
          this.isFastDropping = false;
          this.trailTimer = 0;
          this.isSwapSkillActive = true;
          this.refreshUiState();
        }

        // UI 层第二技能按钮通过这个入口切换锤子技能，技能态只等待点选棋子。
        ;

        _proto.toggleHammerSkillFromUi = function toggleHammerSkillFromUi() {
          if (!this.hasStartedSession) {
            return;
          }
          if (this.isResolving || this.isGameOver || this.isPaused || !this.currentPiece || this.isSwapSkillActive || this.isBombSkillActive) {
            return;
          }
          if (this.isHammerSkillActive) {
            void this.cancelActiveSkillMode();
            return;
          }
          if (!this.ensureSkillAvailable('hammer')) {
            return;
          }
          this.isFastDropping = false;
          this.trailTimer = 0;
          this.isHammerSkillActive = true;
          this.refreshUiState();
        }

        // UI 层第一个技能按钮通过这个入口切换炸弹技能，等待玩家点选爆炸中心。
        ;

        _proto.toggleBombSkillFromUi = function toggleBombSkillFromUi() {
          if (!this.hasStartedSession) {
            return;
          }
          if (this.isResolving || this.isGameOver || this.isPaused || !this.currentPiece || this.isSwapSkillActive || this.isHammerSkillActive) {
            return;
          }
          if (this.isBombSkillActive) {
            void this.cancelActiveSkillMode();
            return;
          }
          if (!this.ensureSkillAvailable('bomb')) {
            return;
          }
          this.isFastDropping = false;
          this.trailTimer = 0;
          this.isBombSkillActive = true;
          this.refreshUiState();
        }

        // 主动取消技能时，如果交换技能已经拎起棋子，需要先把棋子放回原格子。
        ;

        _proto.cancelActiveSkillMode = /*#__PURE__*/
        function () {
          var _cancelActiveSkillMode = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee29() {
            return _regeneratorRuntime().wrap(function _callee29$(_context30) {
              while (1) switch (_context30.prev = _context30.next) {
                case 0:
                  if (!this.swapDragState) {
                    _context30.next = 3;
                    break;
                  }
                  _context30.next = 3;
                  return this.restoreSwapDraggedPiece(this.swapDragState);
                case 3:
                  this.isSwapSkillActive = false;
                  this.isHammerSkillActive = false;
                  this.isBombSkillActive = false;
                  this.refreshUiState();
                case 7:
                case "end":
                  return _context30.stop();
              }
            }, _callee29, this);
          }));
          function cancelActiveSkillMode() {
            return _cancelActiveSkillMode.apply(this, arguments);
          }
          return cancelActiveSkillMode;
        }() // 技能统一在开局前购买；对局中库存不足时只提示，不临时扣金币打断玩法节奏。
        ;

        _proto.ensureSkillAvailable = function ensureSkillAvailable(skill) {
          var _this$uiController14;
          if (this.usedSkillsThisGame[skill]) {
            var _this$uiController13;
            var _skillName = this.getSkillDisplayName(skill);
            (_this$uiController13 = this.uiController) == null || _this$uiController13.showTransientMessage(_skillName + "\u672C\u5C40\u5DF2\u4F7F\u7528\u8FC7");
            return false;
          }
          if (this.economy.hasSkill(skill)) {
            return true;
          }
          var skillName = this.getSkillDisplayName(skill);
          (_this$uiController14 = this.uiController) == null || _this$uiController14.showTransientMessage(skillName + "\u6570\u91CF\u4E0D\u8DB3\uFF0C\u8BF7\u5728\u4E0B\u4E00\u5C40\u5F00\u59CB\u524D\u8D2D\u4E70");
          return false;
        };
        _proto.markSkillUsedThisGame = function markSkillUsedThisGame(skill) {
          this.usedSkillsThisGame[skill] = true;
        };
        _proto.createEmptySkillUsageState = function createEmptySkillUsageState() {
          return {
            bomb: false,
            hammer: false,
            swap: false
          };
        };
        _proto.getSkillDisplayName = function getSkillDisplayName(skill) {
          return skill === 'bomb' ? '炸弹' : skill === 'hammer' ? '锤子' : '交换';
        }

        // 进入游戏结束流程
        ;

        _proto.endGame = function endGame() {
          var _this$audioManager3;
          if (this.isGameOver) {
            return;
          }
          this.isGameOver = true;
          OngoingGameSession.finishGame();
          var finalScore = this.scoreManager.getTotalScore(this.board);
          var highestValue = this.scoreManager.getHighestPieceValue();
          this.gameOverCoinReward = this.calculateGameOverCoinReward(finalScore, highestValue);
          this.economy.addCoins(this.gameOverCoinReward);
          this.isSwapSkillActive = false;
          this.isHammerSkillActive = false;
          this.isBombSkillActive = false;
          this.swapDragState = null;
          this.currentPiece = null;
          this.transientFx.clear();
          (_this$audioManager3 = this.audioManager) == null || _this$audioManager3.pauseBackgroundMusic();
          this.playSoundEffect(this.soundEffectClips.gameOverAudioClip);
          this.refreshUiState();
        };
        _proto.randomBasePieceValue = function randomBasePieceValue() {
          return this.basePieceList[Math.floor(Math.random() * this.basePieceList.length)];
        }

        /**
         * 计算单局结束金币。
         *
         * 分数提供稳定基础产出；最高合成数字提供成长目标奖励；
         * 里程碑奖励让 512/1024/2048 这类关键节点有明显正反馈。
         */;
        _proto.calculateGameOverCoinReward = function calculateGameOverCoinReward(score, highestValue) {
          var safeScore = Math.max(0, Math.floor(score));
          var safeHighest = Math.max(0, Math.floor(highestValue));
          var scoreCoins = Math.floor(safeScore / GAME_OVER_SCORE_COIN_DIVISOR);
          var highestPower = safeHighest > 0 ? Math.floor(Math.log2(safeHighest)) : 0;
          var highestCoins = Math.max(0, highestPower - GAME_OVER_HIGHEST_BASE_POWER) * GAME_OVER_HIGHEST_POWER_COIN;
          var milestoneCoins = safeHighest >= 2048 ? 90 : safeHighest >= 1024 ? 40 : safeHighest >= 512 ? 18 : 0;
          var rawReward = scoreCoins + highestCoins + milestoneCoins;
          return Math.min(GAME_OVER_MAX_COIN_REWARD, Math.max(GAME_OVER_MIN_COIN_REWARD, rawReward));
        }
        // 重新开始游戏并清空棋盘
        ;

        _proto.restartGame = /*#__PURE__*/
        function () {
          var _restartGame = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee30() {
            var _this$audioManager4;
            var _this$uiController15;
            return _regeneratorRuntime().wrap(function _callee30$(_context31) {
              while (1) switch (_context31.prev = _context31.next) {
                case 0:
                  if (!this.isResolving) {
                    _context31.next = 2;
                    break;
                  }
                  return _context31.abrupt("return");
                case 2:
                  if (this.economy.tryConsumeEnergy()) {
                    _context31.next = 5;
                    break;
                  }
                  (_this$uiController15 = this.uiController) == null || _this$uiController15.showTransientMessage('体力不足，请返回首页分享补充');
                  return _context31.abrupt("return");
                case 5:
                  OngoingGameSession.beginNewGame();
                  this.clearBoardPieces();
                  this.transientFx.clear();
                  this.isGameOver = false;
                  this.isFastDropping = false;
                  this.isResolving = false;
                  this.isPaused = false;
                  this.isSwapSkillActive = false;
                  this.isHammerSkillActive = false;
                  this.isBombSkillActive = false;
                  this.swapDragState = null;
                  this.resetBoard();
                  (_this$audioManager4 = this.audioManager) == null || _this$audioManager4.playGameplayBackgroundMusic(this.gameplayBgmClip);
                  this.spawnPiece();
                case 19:
                case "end":
                  return _context31.stop();
              }
            }, _callee30, this);
          }));
          function restartGame() {
            return _restartGame.apply(this, arguments);
          }
          return restartGame;
        }();
        return PlayController;
      }(Component), (_descriptor5 = _applyDecoratedDescriptor(_class5.prototype, "boardwidth", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 5;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class5.prototype, "boardheight", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 7;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class5.prototype, "basePieceController", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class5.prototype, "hammerSkillSpriteFrame", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class5.prototype, "bombSkillSpriteFrame", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class5.prototype, "gameOverPopupSpriteFrame", [_dec12], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class5.prototype, "gameOverReplayButtonSpriteFrame", [_dec13], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class5.prototype, "gameOverHomeButtonSpriteFrame", [_dec14], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor13 = _applyDecoratedDescriptor(_class5.prototype, "gameOverShareButtonSpriteFrame", [_dec15], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor14 = _applyDecoratedDescriptor(_class5.prototype, "collisionAudioClip", [_dec16], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor15 = _applyDecoratedDescriptor(_class5.prototype, "landingMergeAudioClip", [_dec17], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor16 = _applyDecoratedDescriptor(_class5.prototype, "swapRollbackAudioClip", [_dec18], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor17 = _applyDecoratedDescriptor(_class5.prototype, "soundEffectClips", [_dec19], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return new PlaySoundEffectClips();
        }
      }), _descriptor18 = _applyDecoratedDescriptor(_class5.prototype, "gameplayBgmClip", [_dec20], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor19 = _applyDecoratedDescriptor(_class5.prototype, "coinBarPrefab", [_dec21], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor20 = _applyDecoratedDescriptor(_class5.prototype, "homeSceneName", [_dec22], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 'home';
        }
      }), _descriptor21 = _applyDecoratedDescriptor(_class5.prototype, "spacing", [_dec23], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 10;
        }
      }), _descriptor22 = _applyDecoratedDescriptor(_class5.prototype, "x", [_dec24], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return -260;
        }
      }), _descriptor23 = _applyDecoratedDescriptor(_class5.prototype, "y", [_dec25], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return -390;
        }
      }), _descriptor24 = _applyDecoratedDescriptor(_class5.prototype, "pieceSize", [_dec26], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 120;
        }
      }), _descriptor25 = _applyDecoratedDescriptor(_class5.prototype, "fallSpeed", [_dec27], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 360;
        }
      }), _descriptor26 = _applyDecoratedDescriptor(_class5.prototype, "fastFallSpeed", [_dec28], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 1800;
        }
      }), _descriptor27 = _applyDecoratedDescriptor(_class5.prototype, "spawnOffsetY", [_dec29], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0;
        }
      }), _descriptor28 = _applyDecoratedDescriptor(_class5.prototype, "counterNumberSpriteFrames", [_dec30], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      })), _class5)) || _class4));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/PlayerEconomyStore.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _extends, cclegacy, sys;
  return {
    setters: [function (module) {
      _extends = module.extends;
    }, function (module) {
      cclegacy = module.cclegacy;
      sys = module.sys;
    }],
    execute: function () {
      cclegacy._RF.push({}, "dd29abnj2tHtbHouLnl50Uw", "PlayerEconomyStore", undefined);
      // 所有经济数值集中在这里，策划调参时不需要进入首页或玩法流程代码。
      var ECONOMY_CONFIG = exports('ECONOMY_CONFIG', {
        initialEnergy: 3,
        maxEnergy: 4,
        initialCoins: 99999,
        initialSkillCount: 1,
        maxSkillCount: 9,
        dailyLoginCoins: 500,
        shareCoins: 200,
        shareEnergy: 1,
        gameEnergyCost: 1,
        skillPrices: {
          bomb: 500,
          hammer: 300,
          swap: 400
        }
      });
      var STORAGE_KEY = 'number-garden-player-economy-v1';

      /**
       * 跨场景共享的玩家经济仓库。
       *
       * 首页和玩法层只能通过公开方法完成领取、消费和购买；每次成功变更都会立即持久化，
       * 从而保证切换 home/loading/game 场景时资源和技能库存不会被组件生命周期重置。
       */
      var PlayerEconomyStore = exports('PlayerEconomyStore', /*#__PURE__*/function () {
        PlayerEconomyStore.getInstance = function getInstance() {
          if (!this.instance) {
            this.instance = new PlayerEconomyStore();
          }
          return this.instance;
        };
        function PlayerEconomyStore() {
          this.state = void 0;
          this.state = this.loadState();
        }
        var _proto = PlayerEconomyStore.prototype;
        _proto.getSnapshot = function getSnapshot() {
          return {
            energy: this.state.energy,
            maxEnergy: this.state.maxEnergy,
            coins: this.state.coins,
            skills: _extends({}, this.state.skills)
          };
        }

        // 每个本地自然日首次进入首页领取一次金币。
        ;

        _proto.claimDailyLogin = function claimDailyLogin(now) {
          if (now === void 0) {
            now = new Date();
          }
          var today = this.getLocalDateKey(now);
          if (this.state.lastDailyLoginDate === today) {
            return {
              claimed: false,
              amount: 0,
              reason: 'already-claimed'
            };
          }
          this.state.lastDailyLoginDate = today;
          this.state.coins += ECONOMY_CONFIG.dailyLoginCoins;
          this.saveState();
          return {
            claimed: true,
            amount: ECONOMY_CONFIG.dailyLoginCoins,
            reason: 'claimed'
          };
        };
        _proto.canClaimShareReward = function canClaimShareReward(kind) {
          return kind !== 'energy' || this.state.energy < this.state.maxEnergy;
        }

        // 分享奖励不限制每日次数；体力只受体力槽容量限制，金币每次成功分享都可领取。
        ;

        _proto.claimShareReward = function claimShareReward(kind) {
          if (kind === 'energy' && this.state.energy >= this.state.maxEnergy) {
            return {
              claimed: false,
              amount: 0,
              reason: 'energy-full'
            };
          }
          var amount = kind === 'coins' ? ECONOMY_CONFIG.shareCoins : ECONOMY_CONFIG.shareEnergy;
          if (kind === 'coins') {
            this.state.coins += amount;
          } else {
            this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + amount);
          }
          this.saveState();
          return {
            claimed: true,
            amount: amount,
            reason: 'claimed'
          };
        }

        // 单局结算金币由玩法层计算，这里只负责安全入账和持久化。
        ;

        _proto.addCoins = function addCoins(amount) {
          var coins = Math.max(0, Math.floor(amount));
          if (coins <= 0) {
            return {
              added: 0,
              balance: this.state.coins
            };
          }
          this.state.coins += coins;
          this.saveState();
          return {
            added: coins,
            balance: this.state.coins
          };
        }

        // 开始一局和重玩都必须先成功扣除体力。
        ;

        _proto.tryConsumeEnergy = function tryConsumeEnergy(amount) {
          if (amount === void 0) {
            amount = ECONOMY_CONFIG.gameEnergyCost;
          }
          var cost = Math.max(0, Math.floor(amount));
          if (this.state.energy < cost) {
            return false;
          }
          this.state.energy -= cost;
          this.saveState();
          return true;
        };
        _proto.hasSkill = function hasSkill(skill) {
          return this.state.skills[skill] > 0;
        };
        _proto.consumeSkill = function consumeSkill(skill) {
          if (!this.hasSkill(skill)) {
            return false;
          }
          this.state.skills[skill] -= 1;
          this.saveState();
          return true;
        };
        _proto.purchaseSkill = function purchaseSkill(skill) {
          var price = ECONOMY_CONFIG.skillPrices[skill];
          if (this.state.skills[skill] >= ECONOMY_CONFIG.maxSkillCount) {
            return {
              purchased: false,
              price: price,
              balance: this.state.coins,
              reason: 'max-reached'
            };
          }
          if (this.state.coins < price) {
            return {
              purchased: false,
              price: price,
              balance: this.state.coins,
              reason: 'insufficient-coins'
            };
          }
          this.state.coins -= price;
          this.state.skills[skill] += 1;
          this.saveState();
          return {
            purchased: true,
            price: price,
            balance: this.state.coins,
            reason: 'purchased'
          };
        };
        _proto.createDefaultState = function createDefaultState() {
          return {
            version: 1,
            energy: ECONOMY_CONFIG.initialEnergy,
            maxEnergy: ECONOMY_CONFIG.maxEnergy,
            coins: ECONOMY_CONFIG.initialCoins,
            skills: {
              bomb: ECONOMY_CONFIG.initialSkillCount,
              hammer: ECONOMY_CONFIG.initialSkillCount,
              swap: ECONOMY_CONFIG.initialSkillCount
            },
            lastDailyLoginDate: ''
          };
        };
        _proto.loadState = function loadState() {
          var fallback = this.createDefaultState();
          try {
            var _parsed$maxEnergy, _parsed$energy, _parsed$coins, _parsed$skills$bomb, _parsed$skills, _parsed$skills$hammer, _parsed$skills2, _parsed$skills$swap, _parsed$skills3, _parsed$lastDailyLogi;
            var raw = sys.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
              return fallback;
            }
            var parsed = JSON.parse(raw);
            var maxEnergy = Math.max(1, Math.floor((_parsed$maxEnergy = parsed.maxEnergy) != null ? _parsed$maxEnergy : fallback.maxEnergy));
            return {
              version: 1,
              energy: Math.min(maxEnergy, Math.max(0, Math.floor((_parsed$energy = parsed.energy) != null ? _parsed$energy : fallback.energy))),
              maxEnergy: maxEnergy,
              coins: Math.max(0, Math.floor((_parsed$coins = parsed.coins) != null ? _parsed$coins : fallback.coins)),
              skills: {
                bomb: this.clampSkillCount((_parsed$skills$bomb = (_parsed$skills = parsed.skills) == null ? void 0 : _parsed$skills.bomb) != null ? _parsed$skills$bomb : fallback.skills.bomb),
                hammer: this.clampSkillCount((_parsed$skills$hammer = (_parsed$skills2 = parsed.skills) == null ? void 0 : _parsed$skills2.hammer) != null ? _parsed$skills$hammer : fallback.skills.hammer),
                swap: this.clampSkillCount((_parsed$skills$swap = (_parsed$skills3 = parsed.skills) == null ? void 0 : _parsed$skills3.swap) != null ? _parsed$skills$swap : fallback.skills.swap)
              },
              lastDailyLoginDate: (_parsed$lastDailyLogi = parsed.lastDailyLoginDate) != null ? _parsed$lastDailyLogi : ''
            };
          } catch (error) {
            console.warn('玩家经济存档读取失败，已使用默认值', error);
            return fallback;
          }
        };
        _proto.saveState = function saveState() {
          try {
            sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
          } catch (error) {
            console.warn('玩家经济存档写入失败', error);
          }
        };
        _proto.clampSkillCount = function clampSkillCount(count) {
          return Math.min(ECONOMY_CONFIG.maxSkillCount, Math.max(0, Math.floor(count)));
        }

        // 使用本地日期而非 UTC，保证“每日”切换符合玩家所在时区的自然日。
        ;

        _proto.getLocalDateKey = function getLocalDateKey(date) {
          var year = date.getFullYear();
          var monthValue = date.getMonth() + 1;
          var dayValue = date.getDate();
          var month = monthValue < 10 ? "0" + monthValue : "" + monthValue;
          var day = dayValue < 10 ? "0" + dayValue : "" + dayValue;
          return year + "-" + month + "-" + day;
        };
        return PlayerEconomyStore;
      }());
      PlayerEconomyStore.instance = null;
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/PlayUIController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './PauseOverlayController.ts', './GameOverOverlayController.ts'], function (exports) {
  var _inheritsLoose, cclegacy, _decorator, Color, Label, Tween, Vec3, tween, Node, UITransform, Sprite, assetManager, SpriteFrame, Graphics, Widget, sys, screen, UIOpacity, LabelOutline, Component, PauseOverlayController, GameOverOverlayController;
  return {
    setters: [function (module) {
      _inheritsLoose = module.inheritsLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Color = module.Color;
      Label = module.Label;
      Tween = module.Tween;
      Vec3 = module.Vec3;
      tween = module.tween;
      Node = module.Node;
      UITransform = module.UITransform;
      Sprite = module.Sprite;
      assetManager = module.assetManager;
      SpriteFrame = module.SpriteFrame;
      Graphics = module.Graphics;
      Widget = module.Widget;
      sys = module.sys;
      screen = module.screen;
      UIOpacity = module.UIOpacity;
      LabelOutline = module.LabelOutline;
      Component = module.Component;
    }, function (module) {
      PauseOverlayController = module.PauseOverlayController;
    }, function (module) {
      GameOverOverlayController = module.GameOverOverlayController;
    }],
    execute: function () {
      var _dec, _class;
      cclegacy._RF.push({}, "04cf7uQiOZHp7ACO+IwEZbJ", "PlayUIController", undefined);
      var ccclass = _decorator.ccclass;

      // UI 层只关心界面展示所需的最小状态，不参与棋盘运算和合并逻辑。

      // 所有 UI 操作统一通过回调回到玩法层，UI 组件不直接修改棋盘、经济或场景状态。

      // 资源仍由场景序列化后注入，但在 UI 入口处集中成一个对象，避免继续扩张玩法参数列表。

      // 只读取胶囊布局会用到的字段，避免在没有微信类型声明时丢失类型约束。

      // 微信环境里还需要读取窗口高度和顶部原生偏移，才能把胶囊坐标稳定换算到 Cocos 坐标系。

      // 棋盘边框厚度，UI 绘制和棋盘内区布局都会基于这个值计算。
      var BOARD_BORDER_WIDTH = 8;
      // 棋盘内层圆角与棋子圆角保持一致，保证视觉统一。
      var BOARD_INNER_RADIUS = 14;
      // 棋盘外层玻璃阴影色，用很低透明度替代原来的实色边框。
      var BOARD_GLASS_SHADOW_COLOR = new Color(75, 55, 32, 18);
      // 棋盘主体玻璃蒙版色改成浅青蓝灰，保持冷色调但不过度压暗。
      var BOARD_GLASS_TINT_COLOR = new Color(255, 248, 220, 8);
      // 棋盘内区玻璃底色只做浅冷雾化，避免变成厚重实色背景。
      var BOARD_GLASS_INNER_COLOR = new Color(255, 248, 220, 0);
      // 棋盘列的轻量蒙版色，用交替透明块让五列仍然可识别。
      var BOARD_COLUMN_TINT_COLOR = new Color(255, 255, 255, 0);
      // 棋盘列边缘柔光色，让虚线和玻璃面板看起来是一体的。
      var BOARD_COLUMN_EDGE_COLOR = new Color(255, 255, 255, 0);
      // 外层圆角由内层圆角叠加边框厚度得到，确保边框厚度视觉一致。
      var BOARD_OUTER_RADIUS = BOARD_INNER_RADIUS + BOARD_BORDER_WIDTH;
      // 列分隔虚线宽度。
      var BOARD_DASH_WIDTH = 4;
      // 单段虚线长度。
      var BOARD_DASH_LENGTH = 16;
      // 虚线段之间的空隙。
      var BOARD_DASH_GAP = 12;
      // 虚线距离棋盘上下边缘的留白。
      var BOARD_DASH_INSET = 16;
      // 虚线圆角半径，让列分隔更柔和。
      var BOARD_DASH_RADIUS = 2;
      // 虚线颜色改成浅冷柔光，配合新的玻璃蒙版而不是原来的实色样式。
      var BOARD_DASH_COLOR = new Color(255, 255, 255, 0);
      // 技能次数角标的默认位置参考左侧第一个技能的 MoreBtn，也就是无次数时视觉正确的加号位置。
      var SKILL_BADGE_FALLBACK_X = -45.529;
      var SKILL_BADGE_FALLBACK_Y = -40.613;
      // 角标底图和加号图在 scene 中都是 40x40；只有找不到参考节点时才使用这个默认尺寸。
      var SKILL_BADGE_FALLBACK_SIZE = 40;
      // 数字层按 scene 里 Count 小图的视觉尺寸收口，避免有次数时数字显得过大。
      var SKILL_COUNT_WIDTH = 10;
      var SKILL_COUNT_HEIGHT = 20;
      // 首页和游戏资源条统一缩放，游戏内再根据设置按钮位置单独布局。
      var PLAYER_AMOUNT_BAR_SCALE = 0.36;
      var PLAYER_AMOUNT_BAR_SOURCE_HEIGHT = 155;
      var PLAYER_AMOUNT_BAR_DEFAULT_TOP_INSET = 92;
      var PLAYER_AMOUNT_BAR_FALLBACK_X = -190;
      var PLAYER_AMOUNT_BAR_SETTINGS_GAP = 18;
      var PLAYER_AMOUNT_BAR_CAPSULE_GAP = 18;
      // 游戏页以 750×1334 为设计基准，运行时只对安全区做整体补偿。
      var GAME_DESIGN_WIDTH = 750;
      var GAME_DESIGN_HEIGHT = 1334;
      var GAME_BACKGROUND_SPRITE_FRAME_UUID = '5ad49fb5-9e08-4dc5-9ee9-1451320c9378@f9941';
      var GAME_SETTINGS_SPRITE_FRAME_UUID = 'e46abce5-f5e6-4bf3-aa9c-d85173983ec2@f9941';
      var SKILL_ICON_SPRITE_FRAME_UUIDS = {
        bomb: 'c2bd34f2-a783-4855-8af8-fa07fe942dc1@f9941',
        hammer: 'a7c0480a-a4dd-46dc-ab94-4c0df29d1bd8@f9941',
        swap: '32927f70-f651-471d-b8a1-7c2bbe5ddc17@f9941'
      };
      var GAME_BOARD_Y = -60;
      var GAME_SKILLS_Y = -568;
      var HUD_SETTINGS_HIT_SIZE = 76;
      var HUD_SETTINGS_ICON_SIZE = 64;
      var HUD_SETTINGS_X = -325;
      var HUD_SETTINGS_Y = 616;
      var HUD_MODE_WIDTH = 230;
      var HUD_MODE_HEIGHT = 64;
      var HUD_MODE_Y = 615;
      var HUD_OBJECTIVE_WIDTH = 210;
      var HUD_OBJECTIVE_HEIGHT = 90;
      var HUD_OBJECTIVE_Y = 507;
      var HUD_SCORE_WIDTH = 174;
      var HUD_SCORE_HEIGHT = 50;
      var HUD_SCORE_X = 268;
      var HUD_SCORE_Y = 415;
      var HUD_NEXT_X = -297;
      var HUD_NEXT_Y = 400;
      var HUD_SCORE_BG_COLOR = new Color(255, 250, 230, 238);
      var HUD_SCORE_BORDER_COLOR = new Color(91, 61, 35, 235);
      var HUD_SCORE_TEXT_COLOR = new Color(81, 55, 37, 255);
      var HUD_CARD_BG_COLOR = new Color(255, 250, 234, 246);
      var HUD_CARD_BORDER_COLOR = new Color(75, 53, 40, 255);
      var HUD_ACCENT_GREEN = new Color(101, 190, 54, 255);
      var HUD_ACCENT_BLUE = new Color(74, 183, 205, 255);
      var DROP_GUIDE_COLOR = new Color(255, 144, 35, 218);
      var DROP_GUIDE_FILL_COLOR = new Color(109, 225, 238, 30);
      // 技能状态层只做轻量描边和标签，不创建独立材质。
      var SKILL_SELECTION_COLOR = new Color(255, 242, 142, 245);
      var SKILL_DISABLED_OPACITY = 118;
      var SKILL_EMPTY_OPACITY = 178;
      var SKILL_CARD_BORDER_COLOR = new Color(75, 53, 40, 255);
      var SKILL_CARD_INNER_COLORS = {
        bomb: new Color(131, 82, 185, 255),
        hammer: new Color(61, 148, 208, 255),
        swap: new Color(255, 190, 53, 255)
      };
      var SKILL_CARD_LABELS = {
        bomb: '炸弹',
        hammer: '木槌',
        swap: '交换'
      };
      var HUD_PIECE_COLORS = {
        2: new Color(248, 236, 220, 255),
        4: new Color(247, 165, 54, 255),
        8: new Color(255, 194, 46, 255),
        16: new Color(155, 200, 73, 255),
        32: new Color(80, 174, 97, 255),
        64: new Color(53, 161, 165, 255),
        128: new Color(63, 136, 199, 255)
      };
      var PlayUIController = exports('PlayUIController', (_dec = ccclass('PlayUIController'), _dec(_class = /*#__PURE__*/function (_Component) {
        _inheritsLoose(PlayUIController, _Component);
        function PlayUIController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          // 当前棋盘列数，供棋盘绘制和列节点对齐使用。
          _this.boardwidth = 5;
          // 当前棋盘行数，虽然 UI 不直接参与结算，但用于保持绘制配置完整。
          _this.boardheight = 7;
          // 棋子尺寸，主要用于保持 UI 层和逻辑层的棋盘配置一致。
          _this.pieceSize = 120;
          // 格子之间的间距，方便后续继续扩展 UI 布局时保持同一套棋盘参数。
          _this.spacing = 10;
          // 由逻辑层注入的暂停切换回调，按钮点击后只通知逻辑，不直接改游戏状态。
          _this.pauseHandler = null;
          // 暂停弹窗重玩按钮只转交给逻辑层处理，不直接清棋盘。
          _this.pauseReplayHandler = null;
          // 暂停弹窗回首页按钮只转交给逻辑层处理，不直接切页面。
          _this.pauseHomeHandler = null;
          _this.pauseShareHandler = null;
          _this.pauseFeedbackHandler = null;
          // 第一个技能按钮只通知逻辑层进入炸弹技能，不在 UI 层直接操作棋盘。
          _this.bombSkillHandler = null;
          // 第二个技能按钮只通知逻辑层进入锤子技能，不在 UI 层直接操作棋盘。
          _this.hammerSkillHandler = null;
          // 第三个技能按钮只通知逻辑层进入交换技能，不在 UI 层直接改棋盘状态。
          _this.swapSkillHandler = null;
          // 控制栏在 scene 中配置的基础高度，只记录一次，后续只叠加安全区补偿。
          _this.controlBarBaseHeight = 0;
          // Status/Content 的原始局部坐标需要缓存下来，避免非微信平台也被运行时布局覆盖。
          _this.statusContentBasePosition = null;
          // Content 的原始尺寸同样要保留，方便切回编辑器默认布局。
          _this.statusContentBaseSize = null;
          // UI 层缓存当前展示状态，便于统一刷新状态栏、按钮和遮罩。
          _this.currentState = {
            currentValue: null,
            nextValue: null,
            currentColumn: 2,
            score: 0,
            highestValue: 0,
            gameOverCoinReward: 0,
            isGameOver: false,
            isPaused: false,
            isResolving: false,
            activeSkill: null,
            coins: 0,
            skillCounts: {
              bomb: 1,
              hammer: 1,
              swap: 1
            },
            skillUsed: {
              bomb: false,
              hammer: false,
              swap: false
            }
          };
          // 顶部状态栏文字。
          // private statusLabel: Label | null = null
          // 底部暂停按钮文字。
          _this.pauseButtonLabel = null;
          // 分数数值文本直接复用 scene 里的 Score/Number 节点，UI 层只负责刷新显示。
          _this.scoreNumberLabel = null;
          _this.objectiveProgressLabel = null;
          _this.nextValueLabel = null;
          _this.nextValueTile = null;
          _this.dropGuideNode = null;
          // 当前已经显示到界面的分数，数字滚动动画会从这个值补间到目标值。
          _this.displayedScore = 0;
          // Tween 直接驱动这个简单对象，避免去改节点缩放或位置。
          _this.scoreTweenState = {
            value: 0
          };
          // 暂停弹窗相关逻辑全部拆到独立组件，这里只保留组件引用和调用入口。
          _this.pauseOverlayController = null;
          // 游戏结束弹窗同样交给独立组件，UI 主控只负责转交状态和按钮回调。
          _this.gameOverOverlayController = null;
          // 结算弹窗重玩按钮只通知逻辑层重新开局。
          _this.gameOverReplayHandler = null;
          // 结算弹窗分享按钮只通知逻辑层做平台分享适配。
          _this.gameOverShareHandler = null;
          // 结算弹窗首页 icon 只通知逻辑层切回首页，不在 UI 层直接改对局状态。
          _this.gameOverHomeHandler = null;
          // 缓存第一个技能节点，和其他技能共用选中态与取消提示。
          _this.bombSkillNode = null;
          // 缓存第三个技能节点，便于刷新选中态和销毁时解绑事件。
          _this.swapSkillNode = null;
          // 缓存第二个技能节点，和第三技能共用同一套技能态表现。
          _this.hammerSkillNode = null;
          // 三个技能数量图片由 UI 层统一缓存，具体显示由 Skill/Box 下的节点显隐控制。
          _this.skillCountSprites = {
            bomb: null,
            hammer: null,
            swap: null
          };
          // 技能数量 0-9 图片由 PlayController 传入，按图片名匹配当前数量。
          _this.counterNumberSpriteFrames = [];
          // 技能施放提示由运行时生成，避免为了一个提示再要求手动维护 scene 节点。
          _this.skillHintNode = null;
          // 提示透明度单独缓存，方便做进入、闪烁和退出动画。
          _this.skillHintOpacity = null;
          // 记录提示当前是否显示，避免每帧刷新状态时重复重启动画。
          _this.isSkillHintVisible = false;
          _this.feedbackLayer = null;
          _this.toastNode = null;
          _this.toastOpacity = null;
          // 游戏场景顶部只显示金币 Prefab，数值由 PlayUIState 单向渲染。
          _this.coinBarNode = null;
          _this.coinAmountLabel = null;
          _this.coinMoreHandler = null;
          _this.skillVisualKeys = {
            bomb: '',
            hammer: '',
            swap: ''
          };
          return _this;
        }
        var _proto = PlayUIController.prototype;
        // 由逻辑层在启动时调用，把布局、动作和表现资源分别交给 UI 层管理。
        _proto.setup = function setup(options) {
          var _resources$counterNum, _resources$gameOverPo, _resources$gameOverRe, _resources$gameOverHo, _resources$gameOverSh;
          var layout = options.layout,
            actions = options.actions,
            _options$resources = options.resources,
            resources = _options$resources === void 0 ? {} : _options$resources;
          this.boardwidth = layout.boardwidth;
          this.boardheight = layout.boardheight;
          this.pieceSize = layout.pieceSize;
          this.spacing = layout.spacing;
          this.pauseHandler = actions.pause;
          this.pauseReplayHandler = actions.restart;
          this.pauseHomeHandler = actions.homeFromPause;
          this.pauseShareHandler = actions.shareFromPause;
          this.pauseFeedbackHandler = actions.feedbackFromPause;
          this.bombSkillHandler = actions.useBomb;
          this.hammerSkillHandler = actions.useHammer;
          this.swapSkillHandler = actions.useSwap;
          this.gameOverReplayHandler = actions.restart;
          this.gameOverHomeHandler = actions.homeFromGameOver;
          this.gameOverShareHandler = actions.shareFromGameOver;
          this.coinMoreHandler = actions.coinRewardShare;
          this.counterNumberSpriteFrames = (_resources$counterNum = resources.counterNumberSpriteFrames) != null ? _resources$counterNum : [];
          this.fitBackgroundToScreen();
          this.ensureGameBackground();
          this.ensureGamePageLayout();
          this.hideCoinBar();
          this.ensureBoardDecorations();
          this.ensureScoreDisplay();
          this.ensureSkillButtons();
          this.ensureFeedbackLayer();
          this.ensureSkillHint();
          this.ensureToast();
          // this.ensureStatusLabel()
          // this.ensurePauseButton()
          this.ensurePauseOverlay();
          this.ensureGameOverOverlay((_resources$gameOverPo = resources.gameOverPopupSpriteFrame) != null ? _resources$gameOverPo : null, (_resources$gameOverRe = resources.gameOverReplayButtonSpriteFrame) != null ? _resources$gameOverRe : null, (_resources$gameOverHo = resources.gameOverHomeButtonSpriteFrame) != null ? _resources$gameOverHo : null, (_resources$gameOverSh = resources.gameOverShareButtonSpriteFrame) != null ? _resources$gameOverSh : null);
          this.configureControlBar();
          this.configureStatusBar();
          this.updateSkillHintLayout();
          this.renderState(this.currentState);
        }

        // 某些平台启动后一帧安全区才稳定，因此开放一个额外布局入口给逻辑层补收。
        ;

        _proto.syncLayout = function syncLayout() {
          var _this$pauseOverlayCon, _this$gameOverOverlay;
          this.configureControlBar();
          this.configureStatusBar();
          this.updateSkillHintLayout();
          (_this$pauseOverlayCon = this.pauseOverlayController) == null || _this$pauseOverlayCon.syncLayout();
          (_this$gameOverOverlay = this.gameOverOverlayController) == null || _this$gameOverOverlay.syncLayout();
        }

        // 逻辑层每次状态变化后只需要把结果喂给 UI 层即可。
        ;

        _proto.renderState = function renderState(state) {
          var _this$pauseOverlayCon2, _this$gameOverOverlay2;
          this.currentState = state;
          this.refreshScoreDisplay();
          this.refreshObjectiveDisplay();
          this.refreshNextPieceDisplay();
          this.refreshDropGuide();
          this.refreshSkillButtonState();
          // this.refreshStatus()
          // this.refreshPauseButton()
          (_this$pauseOverlayCon2 = this.pauseOverlayController) == null || _this$pauseOverlayCon2.renderState(this.currentState.isPaused);
          (_this$gameOverOverlay2 = this.gameOverOverlayController) == null || _this$gameOverOverlay2.renderState(this.currentState.isGameOver, this.currentState.score, this.currentState.highestValue, this.currentState.gameOverCoinReward);
        };
        /**
         * 显示由逻辑层传入的一次性提示，例如技能购买结果或体力不足。
         * Toast 与技能模式提示拆开，避免临时消息破坏仍处于激活状态的技能提示。
         */
        _proto.showTransientMessage = function showTransientMessage(message) {
          var _this$toastNode$getCh,
            _this$toastNode$getCh2,
            _this2 = this;
          if (!this.toastNode || !this.toastOpacity) {
            return;
          }
          var label = (_this$toastNode$getCh = (_this$toastNode$getCh2 = this.toastNode.getChildByName('Text')) == null ? void 0 : _this$toastNode$getCh2.getComponent(Label)) != null ? _this$toastNode$getCh : null;
          if (!label) {
            return;
          }
          Tween.stopAllByTarget(this.toastNode);
          Tween.stopAllByTarget(this.toastOpacity);
          // FeedbackLayer 保持在 OverlayLayer 下方，不能因为一次 Toast 破坏暂停/结算层的输入优先级。
          this.toastNode.active = true;
          this.toastNode.setScale(new Vec3(0.96, 0.96, 1));
          this.toastOpacity.opacity = 0;
          label.string = message;
          tween(this.toastOpacity).to(0.12, {
            opacity: 255
          }, {
            easing: 'quadOut'
          }).start();
          tween(this.toastNode).to(0.12, {
            scale: Vec3.ONE
          }, {
            easing: 'backOut'
          }).start();
          tween(this.toastOpacity).delay(1.5).to(0.16, {
            opacity: 0
          }, {
            easing: 'quadIn'
          }).call(function () {
            if (_this2.toastNode) {
              _this2.toastNode.active = false;
            }
          }).start();
        };
        _proto.onDestroy = function onDestroy() {
          var _this$skillHintOpacit, _this$toastOpacity;
          // UI 组件自己负责解绑按钮事件，避免逻辑层还要知道具体节点层级。
          var controlContainer = this.canUseNode(this.node) ? this.getControlContainer() : null;
          var pauseButtonNode = this.canUseNode(controlContainer) ? controlContainer.getChildByName('PauseButton') : null;
          this.safeOff(pauseButtonNode, Node.EventType.TOUCH_END, this.onPauseButtonTap);
          this.safeOff(this.bombSkillNode, Node.EventType.TOUCH_END, this.onBombSkillButtonTap);
          this.safeOff(this.hammerSkillNode, Node.EventType.TOUCH_END, this.onHammerSkillButtonTap);
          this.safeOff(this.swapSkillNode, Node.EventType.TOUCH_END, this.onSwapSkillButtonTap);
          this.unbindCoinBar();
          Tween.stopAllByTarget(this.scoreTweenState);
          if (this.canUseNode(this.skillHintNode)) {
            Tween.stopAllByTarget(this.skillHintNode);
          }
          if ((_this$skillHintOpacit = this.skillHintOpacity) != null && _this$skillHintOpacit.isValid) {
            Tween.stopAllByTarget(this.skillHintOpacity);
          }
          if (this.canUseNode(this.toastNode)) {
            Tween.stopAllByTarget(this.toastNode);
          }
          if ((_this$toastOpacity = this.toastOpacity) != null && _this$toastOpacity.isValid) {
            Tween.stopAllByTarget(this.toastOpacity);
          }
          if (this.canUseNode(this.bombSkillNode)) {
            Tween.stopAllByTarget(this.bombSkillNode);
          }
          if (this.canUseNode(this.hammerSkillNode)) {
            Tween.stopAllByTarget(this.hammerSkillNode);
          }
          if (this.canUseNode(this.swapSkillNode)) {
            Tween.stopAllByTarget(this.swapSkillNode);
          }
          this.scoreNumberLabel = null;
          this.objectiveProgressLabel = null;
          this.nextValueLabel = null;
          this.nextValueTile = null;
          this.dropGuideNode = null;
          this.bombSkillNode = null;
          this.hammerSkillNode = null;
          this.swapSkillNode = null;
          this.skillCountSprites.bomb = null;
          this.skillCountSprites.hammer = null;
          this.skillCountSprites.swap = null;
          this.skillHintNode = null;
          this.skillHintOpacity = null;
          this.toastNode = null;
          this.toastOpacity = null;
          this.feedbackLayer = null;
          this.coinBarNode = null;
          this.coinAmountLabel = null;
          this.pauseOverlayController = null;
          this.gameOverOverlayController = null;
        }

        // 背景节点依然挂在 play 根节点上，这里只负责把它铺满整个画布。
        ;

        _proto.fitBackgroundToScreen = function fitBackgroundToScreen() {
          var _this$node$parent$get, _this$node$parent;
          var selfTransform = this.node.getComponent(UITransform);
          var parentTransform = (_this$node$parent$get = (_this$node$parent = this.node.parent) == null ? void 0 : _this$node$parent.getComponent(UITransform)) != null ? _this$node$parent$get : null;
          if (!selfTransform || !parentTransform) {
            return;
          }
          selfTransform.setContentSize(parentTransform.width, parentTransform.height);
          var bgSprite = this.node.getComponent(Sprite);
          if (bgSprite) {
            bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            bgSprite.enabled = true;
          }
        }

        /**
         * 强制使用游戏页已压缩的春日草地背景。
         * Scene 中仍保留序列化引用，UUID 加载用于覆盖预览中可能存在的旧场景缓存。
         */;
        _proto.ensureGameBackground = function ensureGameBackground() {
          var _this3 = this;
          var sprite = this.node.getComponent(Sprite);
          if (!sprite) {
            return;
          }
          sprite.enabled = true;
          sprite.sizeMode = Sprite.SizeMode.CUSTOM;
          assetManager.loadAny(GAME_BACKGROUND_SPRITE_FRAME_UUID, function (error, asset) {
            if (error || !_this3.node.isValid || !(asset instanceof SpriteFrame)) {
              return;
            }
            sprite.spriteFrame = asset;
            sprite.enabled = true;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
          });
        }

        /**
         * 把历史场景节点收口到游戏页设计稿的 750×1334 坐标。
         * 仅调整 UI 容器与棋盘节点，棋盘行列、落子和合并规则不变。
         */;
        _proto.ensureGamePageLayout = function ensureGamePageLayout() {
          var _this$node$getCompone, _statusNode$getCompon, _contentNode$getCompo;
          var rootTransform = (_this$node$getCompone = this.node.getComponent(UITransform)) != null ? _this$node$getCompone : this.node.addComponent(UITransform);
          rootTransform.setContentSize(GAME_DESIGN_WIDTH, GAME_DESIGN_HEIGHT);
          var boardNode = this.node.getChildByName('board');
          if (boardNode) {
            var _boardNode$getCompone;
            boardNode.setPosition(0, GAME_BOARD_Y, 0);
            (_boardNode$getCompone = boardNode.getComponent(UITransform)) == null || _boardNode$getCompone.setContentSize(this.getBoardInnerWidth() + BOARD_BORDER_WIDTH * 2, this.getBoardInnerHeight() + BOARD_BORDER_WIDTH * 2);
          }
          var skillsNode = this.getSkillsContainer();
          if (skillsNode) {
            var _skillsNode$getCompon;
            skillsNode.setPosition(0, GAME_SKILLS_Y, 0);
            (_skillsNode$getCompon = skillsNode.getComponent(UITransform)) == null || _skillsNode$getCompon.setContentSize(520, 124);
            var positions = [-145, 0, 145];
            for (var index = 0; index < 3; index += 1) {
              var _skillsNode$getChildB;
              (_skillsNode$getChildB = skillsNode.getChildByName("Skill" + (index + 1))) == null || _skillsNode$getChildB.setPosition(positions[index], 0, 0);
            }
          }
          var statusNode = this.node.getChildByName('Status');
          var contentNode = statusNode == null ? void 0 : statusNode.getChildByName('Content');
          statusNode == null || statusNode.setPosition(0, 0, 0);
          contentNode == null || contentNode.setPosition(0, 0, 0);
          statusNode == null || (_statusNode$getCompon = statusNode.getComponent(UITransform)) == null || _statusNode$getCompon.setContentSize(GAME_DESIGN_WIDTH, GAME_DESIGN_HEIGHT);
          contentNode == null || (_contentNode$getCompo = contentNode.getComponent(UITransform)) == null || _contentNode$getCompo.setContentSize(GAME_DESIGN_WIDTH, GAME_DESIGN_HEIGHT);
        }

        // 纯代码绘制玻璃棋盘、列蒙版和列分隔线，并同步列节点占位尺寸。
        ;

        _proto.ensureBoardDecorations = function ensureBoardDecorations() {
          var _boardFrame$getCompon, _boardFrame$getCompon2, _dashedLines$getCompo, _dashedLines$getCompo2;
          var boardNode = this.node.getChildByName('board');
          if (!boardNode) {
            return;
          }
          var innerWidth = this.getBoardInnerWidth();
          var innerHeight = this.getBoardInnerHeight();
          var boardSprite = boardNode.getComponent(Sprite);
          if (boardSprite) {
            boardSprite.enabled = false;
          }
          var boardGraphics = boardNode.getComponent(Graphics);
          if (boardGraphics) {
            boardGraphics.clear();
            boardGraphics.enabled = false;
          }
          var boardFrame = boardNode.getChildByName('BoardFrame');
          if (!boardFrame) {
            boardFrame = new Node('BoardFrame');
            boardFrame.setParent(boardNode);
          }
          boardFrame.setPosition(0, 0, 0);
          boardFrame.setSiblingIndex(0);
          var frameTransform = (_boardFrame$getCompon = boardFrame.getComponent(UITransform)) != null ? _boardFrame$getCompon : boardFrame.addComponent(UITransform);
          frameTransform.setContentSize(innerWidth + BOARD_BORDER_WIDTH * 2, innerHeight + BOARD_BORDER_WIDTH * 2);
          var frameGraphics = (_boardFrame$getCompon2 = boardFrame.getComponent(Graphics)) != null ? _boardFrame$getCompon2 : boardFrame.addComponent(Graphics);
          frameGraphics.enabled = true;
          frameGraphics.clear();
          // 外层先铺一层低透明阴影，视觉上保留边界但不再使用厚重实色边框。
          frameGraphics.fillColor = BOARD_GLASS_SHADOW_COLOR;
          frameGraphics.roundRect(-innerWidth / 2 - BOARD_BORDER_WIDTH, -innerHeight / 2 - BOARD_BORDER_WIDTH, innerWidth + BOARD_BORDER_WIDTH * 2, innerHeight + BOARD_BORDER_WIDTH * 2, BOARD_OUTER_RADIUS);
          frameGraphics.fill();

          // 主体玻璃层略小于阴影层，避免外缘太硬，同时覆盖原来的黄色纯色样式。
          frameGraphics.fillColor = BOARD_GLASS_TINT_COLOR;
          frameGraphics.roundRect(-innerWidth / 2 - BOARD_BORDER_WIDTH * 0.65, -innerHeight / 2 - BOARD_BORDER_WIDTH * 0.65, innerWidth + BOARD_BORDER_WIDTH * 1.3, innerHeight + BOARD_BORDER_WIDTH * 1.3, BOARD_OUTER_RADIUS);
          frameGraphics.fill();

          // 内区只保留轻微雾化蒙版，让棋盘仍然有面积感，但不会变成纯色背景。
          frameGraphics.fillColor = BOARD_GLASS_INNER_COLOR;
          frameGraphics.roundRect(-innerWidth / 2, -innerHeight / 2, innerWidth, innerHeight, BOARD_INNER_RADIUS);
          frameGraphics.fill();

          // 不再绘制额外高光条，避免顶部或左侧出现独立白线。

          var boardFill = boardNode.getChildByName('BoardFill');
          if (boardFill) {
            var _boardFill$getCompone;
            boardFill.setPosition(0, 0, 0);
            boardFill.setSiblingIndex(1);
            var fillTransform = boardFill.getComponent(UITransform);
            if (fillTransform) {
              fillTransform.setContentSize(innerWidth, innerHeight);
            }
            var fillSprite = boardFill.getComponent(Sprite);
            if (fillSprite) {
              fillSprite.enabled = false;
            }
            var fillGraphics = (_boardFill$getCompone = boardFill.getComponent(Graphics)) != null ? _boardFill$getCompone : boardFill.addComponent(Graphics);
            fillGraphics.enabled = false;
            fillGraphics.clear();
          }
          for (var column = 0; column < this.boardwidth; column++) {
            var columnNode = boardNode.getChildByName("column" + (column + 1));
            if (!columnNode) {
              continue;
            }
            columnNode.setPosition(this.getBoardColumnCenterX(column), 0, 0);
            var columnTransform = columnNode.getComponent(UITransform);
            if (columnTransform) {
              columnTransform.setContentSize(innerWidth / this.boardwidth, innerHeight);
            }
            var columnSprite = columnNode.getComponent(Sprite);
            if (columnSprite) {
              // 列节点只保留占位，不再使用半透明底色。
              columnSprite.enabled = false;
            }
          }
          var dashedLines = boardNode.getChildByName('BoardDashedLines');
          if (!dashedLines) {
            dashedLines = new Node('BoardDashedLines');
            dashedLines.setParent(boardNode);
          }
          dashedLines.setPosition(0, 0, 0);
          // 列样式只作为棋盘背景存在，优先放在 BoardFill 后面、列节点前面，避免覆盖棋子。
          var columnDecorationIndex = boardFill ? 2 : 1;
          dashedLines.setSiblingIndex(Math.min(columnDecorationIndex, boardNode.children.length - 1));
          var dashedTransform = (_dashedLines$getCompo = dashedLines.getComponent(UITransform)) != null ? _dashedLines$getCompo : dashedLines.addComponent(UITransform);
          dashedTransform.setContentSize(innerWidth, innerHeight);
          var graphics = (_dashedLines$getCompo2 = dashedLines.getComponent(Graphics)) != null ? _dashedLines$getCompo2 : dashedLines.addComponent(Graphics);
          graphics.clear();
          var top = innerHeight / 2 - BOARD_DASH_INSET;
          var bottom = -innerHeight / 2 + BOARD_DASH_INSET;
          var columnWidth = innerWidth / this.boardwidth;
          // 使用交替列蒙版表达五等分列，同时透明度很低，不会抢棋子的视觉焦点。
          for (var _column = 0; _column < this.boardwidth; _column++) {
            if (_column % 2 !== 0) {
              continue;
            }
            graphics.fillColor = BOARD_COLUMN_TINT_COLOR;
            graphics.roundRect(-innerWidth / 2 + columnWidth * _column + 5, bottom, columnWidth - 10, top - bottom, BOARD_INNER_RADIUS);
            graphics.fill();
          }
          for (var _column2 = 0; _column2 < this.boardwidth - 1; _column2++) {
            var x = this.getBoardSeparatorX(_column2);
            // 每条分隔线先铺一条柔光底，再叠加短虚线，避免虚线像单独贴上去的素材。
            graphics.fillColor = BOARD_COLUMN_EDGE_COLOR;
            graphics.roundRect(x - BOARD_DASH_WIDTH / 2, bottom, BOARD_DASH_WIDTH, top - bottom, BOARD_DASH_RADIUS);
            graphics.fill();
            graphics.fillColor = BOARD_DASH_COLOR;
            for (var y = bottom; y < top; y += BOARD_DASH_LENGTH + BOARD_DASH_GAP) {
              var segmentEnd = Math.min(y + BOARD_DASH_LENGTH, top);
              graphics.roundRect(x - BOARD_DASH_WIDTH / 2, y, BOARD_DASH_WIDTH, Math.max(0, segmentEnd - y), BOARD_DASH_RADIUS);
            }
            graphics.fill();
          }
          this.ensureDropGuide(boardNode, innerHeight);
        }

        // 设计稿用浅色通道和橙色虚线表示当前落子列，替代旧版粒子拖尾。
        ;

        _proto.ensureDropGuide = function ensureDropGuide(boardNode, innerHeight) {
          var _guideNode$getCompone;
          var guideNode = boardNode.getChildByName('DropGuide');
          if (!guideNode) {
            guideNode = new Node('DropGuide');
            guideNode.setParent(boardNode);
            guideNode.addComponent(UITransform);
            guideNode.addComponent(Graphics);
          }
          (_guideNode$getCompone = guideNode.getComponent(UITransform)) == null || _guideNode$getCompone.setContentSize(this.pieceSize * 0.8, innerHeight + 62);
          guideNode.setSiblingIndex(Math.min(3, boardNode.children.length - 1));
          this.dropGuideNode = guideNode;
          this.drawDropGuide(innerHeight);
        };
        _proto.drawDropGuide = function drawDropGuide(innerHeight) {
          var _this$dropGuideNode;
          var graphics = (_this$dropGuideNode = this.dropGuideNode) == null ? void 0 : _this$dropGuideNode.getComponent(Graphics);
          if (!graphics) {
            return;
          }
          var halfWidth = this.pieceSize * 0.38;
          var top = innerHeight * 0.5 - 58;
          var bottom = -innerHeight * 0.5 + 30;
          graphics.clear();
          graphics.fillColor = DROP_GUIDE_FILL_COLOR;
          graphics.roundRect(-halfWidth, bottom, halfWidth * 2, top - bottom, 18);
          graphics.fill();
          graphics.fillColor = DROP_GUIDE_COLOR;
          for (var y = top - 18; y > bottom + 38; y -= 27) {
            graphics.roundRect(-4, y - 9, 8, 18, 4);
          }
          graphics.fill();
          graphics.moveTo(-13, bottom + 42);
          graphics.lineTo(0, bottom + 27);
          graphics.lineTo(13, bottom + 42);
          graphics.lineTo(13, bottom + 52);
          graphics.lineTo(0, bottom + 38);
          graphics.lineTo(-13, bottom + 52);
          graphics.close();
          graphics.fill();
        };
        _proto.refreshDropGuide = function refreshDropGuide() {
          if (!this.dropGuideNode) {
            return;
          }
          var column = Math.max(0, Math.min(this.boardwidth - 1, this.currentState.currentColumn));
          this.dropGuideNode.setPosition(this.getBoardColumnCenterX(column), 0, 0);
          this.dropGuideNode.active = !this.currentState.isGameOver;
        }

        // 确保状态文字节点存在；如果 scene 中没有，就由 UI 层自行补建。
        // private ensureStatusLabel() {
        //   const existing = this.node.getChildByName('StatusLabel')
        //   if (existing) {
        //     // this.statusLabel = existing.getComponent(Label)
        //     return
        //   }

        //   const labelNode = new Node('StatusLabel')
        //   labelNode.setParent(this.node)
        //   labelNode.setPosition(0, 565, 0)

        //   const transform = labelNode.addComponent(UITransform)
        //   transform.setContentSize(680, 80)

        //   const label = labelNode.addComponent(Label)
        //   label.fontSize = 28
        //   label.lineHeight = 34
        //   label.horizontalAlign = Label.HorizontalAlign.CENTER
        //   label.color = new Color(250, 246, 242, 255)

        //   // this.statusLabel = label
        // }

        // 确保底部控制栏里的暂停按钮存在；如果 scene 已经配好，就直接复用。
        // private ensurePauseButton() {
        //   const container = this.getControlContainer()
        //   const existing = container.getChildByName('PauseButton')
        //   if (existing) {
        //     this.pauseButtonLabel = existing.getChildByName('Label')?.getComponent(Label) ?? null
        //     existing.off(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
        //     existing.on(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
        //     return
        //   }

        //   const buttonNode = new Node('PauseButton')
        //   buttonNode.setParent(container)
        //   buttonNode.setPosition(0, 0, 0)

        //   const transform = buttonNode.addComponent(UITransform)
        //   transform.setContentSize(140, 56)
        //   buttonNode.addComponent(Button)

        //   const bg = buttonNode.addComponent(Sprite)
        //   bg.color = new Color(37, 55, 80, 235)

        //   const labelNode = new Node('Label')
        //   labelNode.setParent(buttonNode)
        //   labelNode.setPosition(0, 0, 0)
        //   const labelTransform = labelNode.addComponent(UITransform)
        //   labelTransform.setContentSize(140, 56)

        //   const label = labelNode.addComponent(Label)
        //   // label.string = 'Pause'
        //   label.fontSize = 26
        //   label.lineHeight = 30
        //   label.horizontalAlign = Label.HorizontalAlign.CENTER
        //   label.verticalAlign = Label.VerticalAlign.CENTER
        //   label.color = new Color(245, 250, 255, 255)
        //   buttonNode.on(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
        //   this.pauseButtonLabel = label
        // }

        // PauseOverlay 根节点仍由主 UI 层接入，但节点内部动画和事件完全交给独立组件处理。
        ;

        _proto.ensurePauseOverlay = function ensurePauseOverlay() {
          var _overlayLayer$getChil, _overlay$getComponent;
          var overlayLayer = this.ensureOverlayLayer();
          var overlay = (_overlayLayer$getChil = overlayLayer.getChildByName('PauseOverlay')) != null ? _overlayLayer$getChil : this.node.getChildByName('PauseOverlay');
          if (!overlay) {
            overlay = new Node('PauseOverlay');
            overlay.setParent(overlayLayer);
            overlay.active = false;
            overlay.addComponent(UITransform).setContentSize(750, 1334);
          } else if (overlay.parent !== overlayLayer) {
            // OverlayLayer 与 Main 使用同一原点，迁移旧节点不会改变暂停面板的局部坐标。
            overlay.setParent(overlayLayer);
          }
          this.pauseOverlayController = (_overlay$getComponent = overlay.getComponent(PauseOverlayController)) != null ? _overlay$getComponent : overlay.addComponent(PauseOverlayController);
          this.pauseOverlayController.setup({
            hostNode: this.node,
            pauseHandler: this.pauseHandler,
            replayHandler: this.pauseReplayHandler,
            homeHandler: this.pauseHomeHandler,
            shareHandler: this.pauseShareHandler,
            feedbackHandler: this.pauseFeedbackHandler
          });
        }

        // 优先绑定场景中的固定 GameOverOverlay 根节点，旧场景缺失时只补最小挂点。
        ;

        _proto.ensureGameOverOverlay = function ensureGameOverOverlay(popupSpriteFrame, replayButtonSpriteFrame, homeButtonSpriteFrame, shareButtonSpriteFrame) {
          var _overlayLayer$getChil2, _overlay$getComponent2;
          var overlayLayer = this.ensureOverlayLayer();
          var overlay = (_overlayLayer$getChil2 = overlayLayer.getChildByName('GameOverOverlay')) != null ? _overlayLayer$getChil2 : this.node.getChildByName('GameOverOverlay');
          if (!overlay) {
            overlay = new Node('GameOverOverlay');
            overlay.setParent(overlayLayer);
            overlay.active = false;
            overlay.addComponent(UITransform).setContentSize(750, 1334);
          } else if (overlay.parent !== overlayLayer) {
            overlay.setParent(overlayLayer);
          }
          this.gameOverOverlayController = (_overlay$getComponent2 = overlay.getComponent(GameOverOverlayController)) != null ? _overlay$getComponent2 : overlay.addComponent(GameOverOverlayController);
          this.gameOverOverlayController.setup({
            hostNode: this.node,
            replayHandler: this.gameOverReplayHandler,
            homeHandler: this.gameOverHomeHandler,
            shareHandler: this.gameOverShareHandler,
            popupSpriteFrame: popupSpriteFrame,
            replayButtonSpriteFrame: replayButtonSpriteFrame,
            homeButtonSpriteFrame: homeButtonSpriteFrame,
            shareButtonSpriteFrame: shareButtonSpriteFrame
          });
        }

        // Scene 中固定提供覆盖层挂点；旧场景缺失时只补一个与 Main 同原点的空容器。
        ;

        _proto.ensureOverlayLayer = function ensureOverlayLayer() {
          var _layer$getComponent, _hostTransform$width, _hostTransform$height;
          var layer = this.node.getChildByName('OverlayLayer');
          if (!layer) {
            layer = new Node('OverlayLayer');
            layer.setParent(this.node);
            layer.addComponent(UITransform);
          }
          var hostTransform = this.node.getComponent(UITransform);
          var transform = (_layer$getComponent = layer.getComponent(UITransform)) != null ? _layer$getComponent : layer.addComponent(UITransform);
          transform.setContentSize((_hostTransform$width = hostTransform == null ? void 0 : hostTransform.width) != null ? _hostTransform$width : 750, (_hostTransform$height = hostTransform == null ? void 0 : hostTransform.height) != null ? _hostTransform$height : 1334);
          layer.setPosition(0, 0, 0);
          layer.setSiblingIndex(this.node.children.length - 1);
          return layer;
        }

        // 顶部 HUD 复用 scene 中的固定节点，脚本只统一视觉、触摸热区和动态分数。
        ;

        _proto.ensureScoreDisplay = function ensureScoreDisplay() {
          var _this$node$getChildBy, _statusContent$getChi, _ref, _ref2, _statusContent$getChi2, _scoreNode$getCompone, _titleNode$getCompone, _numberNode$getCompon;
          var statusContent = (_this$node$getChildBy = this.node.getChildByName('Status')) == null ? void 0 : _this$node$getChildBy.getChildByName('Content');
          if (!statusContent) {
            return;
          }
          this.ensureSettingsButtonVisual((_statusContent$getChi = statusContent == null ? void 0 : statusContent.getChildByName('SettingsBtn')) != null ? _statusContent$getChi : null);
          this.ensureModeCard(statusContent);
          this.ensureObjectiveCard(statusContent);
          this.ensureNextPieceCard(statusContent);
          var scoreNode = (_ref = (_ref2 = (_statusContent$getChi2 = statusContent == null ? void 0 : statusContent.getChildByName('Score')) != null ? _statusContent$getChi2 : statusContent == null ? void 0 : statusContent.getChildByName('Source')) != null ? _ref2 : this.node.getChildByName('Score')) != null ? _ref : this.node.getChildByName('Source');
          if (!scoreNode) {
            return;
          }
          scoreNode.setPosition(HUD_SCORE_X, HUD_SCORE_Y, 0);
          var scoreTransform = (_scoreNode$getCompone = scoreNode.getComponent(UITransform)) != null ? _scoreNode$getCompone : scoreNode.addComponent(UITransform);
          scoreTransform.setContentSize(HUD_SCORE_WIDTH, HUD_SCORE_HEIGHT);
          this.drawScoreCard(scoreNode);
          var titleNode = scoreNode.getChildByName('Label');
          var titleLabel = (_titleNode$getCompone = titleNode == null ? void 0 : titleNode.getComponent(Label)) != null ? _titleNode$getCompone : null;
          if (titleNode && titleLabel) {
            var _titleNode$getCompone2;
            titleNode.setPosition(-26, 0, 0);
            (_titleNode$getCompone2 = titleNode.getComponent(UITransform)) == null || _titleNode$getCompone2.setContentSize(58, 36);
            titleLabel.string = '分数';
            titleLabel.fontSize = 20;
            titleLabel.lineHeight = 24;
            titleLabel.color = HUD_SCORE_TEXT_COLOR;
            titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            titleLabel.verticalAlign = Label.VerticalAlign.CENTER;
            titleLabel.isBold = true;
            titleLabel.enableOutline = false;
            titleLabel.enableShadow = false;
            var titleOutline = titleNode.getComponent(LabelOutline);
            if (titleOutline) {
              titleOutline.enabled = false;
            }
          }
          this.ensureScoreStar(scoreNode);
          var numberNode = scoreNode.getChildByName('Number');
          this.scoreNumberLabel = (_numberNode$getCompon = numberNode == null ? void 0 : numberNode.getComponent(Label)) != null ? _numberNode$getCompon : null;
          if (numberNode && this.scoreNumberLabel) {
            var _numberNode$getCompon2;
            numberNode.setPosition(42, 0, 0);
            (_numberNode$getCompon2 = numberNode.getComponent(UITransform)) == null || _numberNode$getCompon2.setContentSize(88, 40);
            this.scoreNumberLabel.fontSize = 25;
            this.scoreNumberLabel.lineHeight = 30;
            this.scoreNumberLabel.color = HUD_SCORE_TEXT_COLOR;
            this.scoreNumberLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.scoreNumberLabel.verticalAlign = Label.VerticalAlign.CENTER;
            this.scoreNumberLabel.isBold = true;
            this.scoreNumberLabel.enableOutline = false;
            this.scoreNumberLabel.enableShadow = false;
            var numberOutline = numberNode.getComponent(LabelOutline);
            if (numberOutline) {
              numberOutline.enabled = false;
            }
          }
          this.displayedScore = this.currentState.score;
          this.scoreTweenState.value = this.currentState.score;
        };
        _proto.ensureScoreStar = function ensureScoreStar(scoreNode) {
          var _starNode$getComponent;
          var starNode = this.ensureHudNode(scoreNode, 'Star', -66, 0, 28, 28);
          var star = (_starNode$getComponent = starNode.getComponent(Graphics)) != null ? _starNode$getComponent : starNode.addComponent(Graphics);
          star.clear();
          star.fillColor = HUD_CARD_BORDER_COLOR;
          this.traceStar(star, 0, 0, 14, 7);
          star.fill();
          star.fillColor = new Color(255, 193, 48, 255);
          this.traceStar(star, 0, 0, 10.5, 5.2);
          star.fill();
        };
        _proto.traceStar = function traceStar(graphics, x, y, outerRadius, innerRadius) {
          for (var index = 0; index < 10; index += 1) {
            var radius = index % 2 === 0 ? outerRadius : innerRadius;
            var angle = -Math.PI / 2 + index * Math.PI / 5;
            var pointX = x + Math.cos(angle) * radius;
            var pointY = y + Math.sin(angle) * radius;
            if (index === 0) {
              graphics.moveTo(pointX, pointY);
            } else {
              graphics.lineTo(pointX, pointY);
            }
          }
          graphics.close();
        };
        _proto.ensureModeCard = function ensureModeCard(parent) {
          var _markNode$getComponen;
          var card = this.ensureHudCard(parent, 'ModeCard', 0, HUD_MODE_Y, HUD_MODE_WIDTH, HUD_MODE_HEIGHT, 20);
          var markNode = this.ensureHudNode(card, 'Mark', -78, 0, 28, 28);
          var mark = (_markNode$getComponen = markNode.getComponent(Graphics)) != null ? _markNode$getComponen : markNode.addComponent(Graphics);
          mark.clear();
          mark.fillColor = HUD_CARD_BORDER_COLOR;
          mark.moveTo(0, 14);
          mark.lineTo(14, 0);
          mark.lineTo(0, -14);
          mark.lineTo(-14, 0);
          mark.close();
          mark.fill();
          mark.fillColor = HUD_ACCENT_GREEN;
          mark.moveTo(0, 10);
          mark.lineTo(10, 0);
          mark.lineTo(0, -10);
          mark.lineTo(-10, 0);
          mark.close();
          mark.fill();
          this.ensureHudLabel(card, 'Label', '第12关', 22, 0, 156, 46, 29, HUD_SCORE_TEXT_COLOR);
        };
        _proto.ensureObjectiveCard = function ensureObjectiveCard(parent) {
          var _iconNode$getComponen, _progressNode$getComp;
          var card = this.ensureHudCard(parent, 'ObjectiveCard', 0, HUD_OBJECTIVE_Y, HUD_OBJECTIVE_WIDTH, HUD_OBJECTIVE_HEIGHT, 22);
          var iconNode = this.ensureHudNode(card, 'Icon', -62, 0, 58, 58);
          var icon = (_iconNode$getComponen = iconNode.getComponent(Graphics)) != null ? _iconNode$getComponen : iconNode.addComponent(Graphics);
          icon.clear();
          icon.fillColor = HUD_CARD_BORDER_COLOR;
          icon.roundRect(-29, -29, 58, 58, 12);
          icon.fill();
          icon.fillColor = new Color(221, 248, 247, 255);
          icon.roundRect(-25, -25, 50, 50, 9);
          icon.fill();
          icon.strokeColor = HUD_ACCENT_BLUE;
          icon.lineWidth = 4;
          icon.moveTo(-13, 0);
          icon.lineTo(13, 0);
          icon.moveTo(0, -13);
          icon.lineTo(0, 13);
          icon.moveTo(-9, -9);
          icon.lineTo(9, 9);
          icon.moveTo(-9, 9);
          icon.lineTo(9, -9);
          icon.stroke();
          var oldTitle = card.getChildByName('Title');
          var oldDescription = card.getChildByName('Description');
          oldTitle == null || oldTitle.destroy();
          oldDescription == null || oldDescription.destroy();
          var progressNode = this.ensureHudNode(card, 'Progress', 43, 0, 94, 62);
          var oldProgress = progressNode.getComponent(Graphics);
          oldProgress == null || oldProgress.clear();
          this.objectiveProgressLabel = this.ensureHudLabel(progressNode, 'Value', '0/8', 0, 0, 92, 54, 38, HUD_SCORE_TEXT_COLOR);
        };
        _proto.ensureNextPieceCard = function ensureNextPieceCard(parent) {
          var _tileNode$getComponen;
          var card = this.ensureHudNode(parent, 'NextPieceCard', HUD_NEXT_X, HUD_NEXT_Y, 108, 108);
          var oldCardGraphics = card.getComponent(Graphics);
          oldCardGraphics == null || oldCardGraphics.clear();
          var nextTitle = this.ensureHudLabel(card, 'Title', '下一枚', 0, 27, 92, 28, 20, HUD_SCORE_TEXT_COLOR);
          nextTitle.enableOutline = true;
          nextTitle.outlineColor = new Color(255, 250, 230, 255);
          nextTitle.outlineWidth = 3;
          var tileNode = this.ensureHudNode(card, 'Tile', 0, -18, 52, 52);
          this.nextValueTile = (_tileNode$getComponen = tileNode.getComponent(Graphics)) != null ? _tileNode$getComponen : tileNode.addComponent(Graphics);
          this.nextValueLabel = this.ensureHudLabel(tileNode, 'Value', '2', 0, 0, 48, 42, 24, HUD_SCORE_TEXT_COLOR);
          this.refreshNextPieceDisplay();
        };
        _proto.ensureHudCard = function ensureHudCard(parent, name, x, y, width, height, radius) {
          var _node$getComponent;
          var node = this.ensureHudNode(parent, name, x, y, width, height);
          var graphics = (_node$getComponent = node.getComponent(Graphics)) != null ? _node$getComponent : node.addComponent(Graphics);
          graphics.clear();
          graphics.fillColor = HUD_CARD_BORDER_COLOR;
          graphics.roundRect(-width * 0.5, -height * 0.5, width, height, radius);
          graphics.fill();
          graphics.fillColor = HUD_CARD_BG_COLOR;
          graphics.roundRect(-width * 0.5 + 3, -height * 0.5 + 3, width - 6, height - 6, Math.max(1, radius - 3));
          graphics.fill();
          return node;
        };
        _proto.ensureHudNode = function ensureHudNode(parent, name, x, y, width, height) {
          var _node$getComponent2;
          var node = parent.getChildByName(name);
          if (!node) {
            node = new Node(name);
            node.setParent(parent);
            node.addComponent(UITransform);
          }
          node.setPosition(x, y, 0);
          var transform = (_node$getComponent2 = node.getComponent(UITransform)) != null ? _node$getComponent2 : node.addComponent(UITransform);
          transform.setContentSize(width, height);
          return node;
        };
        _proto.ensureHudLabel = function ensureHudLabel(parent, name, text, x, y, width, height, fontSize, color) {
          var _node$getComponent3;
          var node = this.ensureHudNode(parent, name, x, y, width, height);
          var label = (_node$getComponent3 = node.getComponent(Label)) != null ? _node$getComponent3 : node.addComponent(Label);
          label.string = text;
          label.fontSize = fontSize;
          label.lineHeight = Math.ceil(fontSize * 1.18);
          label.color = color;
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
          label.isBold = true;
          return label;
        }

        // 设置按钮视觉尺寸与触摸热区分离，保证图标克制但左上角仍容易点击。
        ;

        _proto.ensureSettingsButtonVisual = function ensureSettingsButtonVisual(settingsNode) {
          var _settingsNode$getComp, _iconNode$getComponen2;
          if (!settingsNode) {
            return;
          }
          settingsNode.setPosition(HUD_SETTINGS_X, HUD_SETTINGS_Y, 0);
          var settingsTransform = (_settingsNode$getComp = settingsNode.getComponent(UITransform)) != null ? _settingsNode$getComp : settingsNode.addComponent(UITransform);
          settingsTransform.setContentSize(HUD_SETTINGS_HIT_SIZE, HUD_SETTINGS_HIT_SIZE);
          var settingsWidget = settingsNode.getComponent(Widget);
          if (settingsWidget) {
            // HUD 已统一使用游戏页坐标，禁用旧 Widget 防止它在下一帧把设置按钮拉回历史偏移。
            settingsWidget.enabled = false;
          }
          var rootSprite = settingsNode.getComponent(Sprite);
          var iconNode = settingsNode.getChildByName('Icon');
          if (!iconNode) {
            iconNode = new Node('Icon');
            iconNode.setParent(settingsNode);
            iconNode.addComponent(UITransform);
            iconNode.addComponent(Sprite);
          }
          iconNode.setPosition(0, 0, 0);
          (_iconNode$getComponen2 = iconNode.getComponent(UITransform)) == null || _iconNode$getComponen2.setContentSize(HUD_SETTINGS_ICON_SIZE, HUD_SETTINGS_ICON_SIZE);
          var iconSprite = iconNode.getComponent(Sprite);
          if (iconSprite) {
            var _rootSprite$spriteFra;
            iconSprite.spriteFrame = (_rootSprite$spriteFra = rootSprite == null ? void 0 : rootSprite.spriteFrame) != null ? _rootSprite$spriteFra : iconSprite.spriteFrame;
            iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            assetManager.loadAny(GAME_SETTINGS_SPRITE_FRAME_UUID, function (error, asset) {
              if (!error && iconSprite.node.isValid && asset instanceof SpriteFrame) {
                iconSprite.spriteFrame = asset;
                iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
                var iconTransform = iconSprite.node.getComponent(UITransform);
                iconTransform == null || iconTransform.setContentSize(HUD_SETTINGS_ICON_SIZE, HUD_SETTINGS_ICON_SIZE);
              }
            });
          }
          if (rootSprite) {
            rootSprite.enabled = false;
          }
        }

        // 分数卡用轻量 Graphics 绘制，避免为一个可伸缩小面板增加新的大图。
        ;

        _proto.drawScoreCard = function drawScoreCard(scoreNode) {
          var _scoreNode$getCompone2;
          var graphics = (_scoreNode$getCompone2 = scoreNode.getComponent(Graphics)) != null ? _scoreNode$getCompone2 : scoreNode.addComponent(Graphics);
          graphics.clear();
          graphics.fillColor = HUD_SCORE_BORDER_COLOR;
          graphics.roundRect(-HUD_SCORE_WIDTH * 0.5, -HUD_SCORE_HEIGHT * 0.5, HUD_SCORE_WIDTH, HUD_SCORE_HEIGHT, 18);
          graphics.fill();
          graphics.fillColor = HUD_SCORE_BG_COLOR;
          graphics.roundRect(-HUD_SCORE_WIDTH * 0.5 + 3, -HUD_SCORE_HEIGHT * 0.5 + 3, HUD_SCORE_WIDTH - 6, HUD_SCORE_HEIGHT - 6, 15);
          graphics.fill();
        }

        // 分数字样改成“数字递增”动画；加分时逐步滚到目标值，减分或清零时直接同步。
        ;

        _proto.refreshScoreDisplay = function refreshScoreDisplay() {
          var _this4 = this;
          if (!this.scoreNumberLabel) {
            return;
          }
          var nextScore = Math.max(0, Math.floor(this.currentState.score));
          var currentScore = Math.max(0, Math.floor(this.displayedScore));
          Tween.stopAllByTarget(this.scoreTweenState);
          if (nextScore <= currentScore) {
            // 重开或回退时直接落到目标值，避免分数向下滚动造成误解。
            this.displayedScore = nextScore;
            this.scoreTweenState.value = nextScore;
            this.scoreNumberLabel.string = "" + nextScore;
            return;
          }

          // 差值越大动画稍微长一点，但整体仍然控制在很短的 UI 反馈范围内。
          var duration = Math.min(0.36, Math.max(0.08, (nextScore - currentScore) / 900));
          this.scoreTweenState.value = currentScore;
          tween(this.scoreTweenState).to(duration, {
            value: nextScore
          }, {
            easing: 'quadOut',
            onUpdate: function onUpdate(target) {
              var value = Math.min(nextScore, Math.round(target.value));
              _this4.displayedScore = value;
              if (_this4.scoreNumberLabel) {
                _this4.scoreNumberLabel.string = "" + value;
              }
            }
          }).start();
        };
        _proto.refreshObjectiveDisplay = function refreshObjectiveDisplay() {
          if (this.objectiveProgressLabel) {
            this.objectiveProgressLabel.string = '0/8';
          }
        };
        _proto.refreshNextPieceDisplay = function refreshNextPieceDisplay() {
          var _this$currentState$ne, _HUD_PIECE_COLORS$val;
          if (!this.nextValueLabel || !this.nextValueTile) {
            return;
          }
          var value = (_this$currentState$ne = this.currentState.nextValue) != null ? _this$currentState$ne : 2;
          var bodyColor = (_HUD_PIECE_COLORS$val = HUD_PIECE_COLORS[value]) != null ? _HUD_PIECE_COLORS$val : new Color(207, 88, 109, 255);
          this.nextValueTile.clear();
          this.nextValueTile.fillColor = HUD_CARD_BORDER_COLOR;
          this.nextValueTile.roundRect(-26, -26, 52, 52, 9);
          this.nextValueTile.fill();
          this.nextValueTile.fillColor = bodyColor;
          this.nextValueTile.roundRect(-23, -23, 46, 46, 7);
          this.nextValueTile.fill();
          this.nextValueLabel.string = "" + value;
          this.nextValueLabel.fontSize = value >= 100 ? 19 : value >= 10 ? 21 : 24;
          this.nextValueLabel.color = new Color(255, 249, 234, 255);
          this.nextValueLabel.enableOutline = true;
          this.nextValueLabel.outlineColor = HUD_CARD_BORDER_COLOR;
          this.nextValueLabel.outlineWidth = 2;
        }

        // 游戏内不再展示金币余额；金币仍由经济仓库维护，首页和购买弹窗按需展示。
        ;

        _proto.hideCoinBar = function hideCoinBar() {
          var _this$coinBarNode$get, _this$coinBarNode$get2;
          this.coinBarNode = this.node.getChildByName('CoinBar');
          if (!this.coinBarNode) {
            return;
          }
          this.coinAmountLabel = (_this$coinBarNode$get = (_this$coinBarNode$get2 = this.coinBarNode.getChildByName('Amount')) == null ? void 0 : _this$coinBarNode$get2.getComponent(Label)) != null ? _this$coinBarNode$get : null;
          this.unbindCoinBar();
          this.coinBarNode.active = false;
          this.coinBarNode = null;
          this.coinAmountLabel = null;
        };
        _proto.unbindCoinBar = function unbindCoinBar() {
          var _this$coinBarNode;
          if (!((_this$coinBarNode = this.coinBarNode) != null && _this$coinBarNode.isValid)) {
            return;
          }
          this.coinBarNode.off(Node.EventType.TOUCH_START, this.handleCoinBarPressStart, this);
          this.coinBarNode.off(Node.EventType.TOUCH_END, this.handleCoinBarPressEnd, this);
          this.coinBarNode.off(Node.EventType.TOUCH_CANCEL, this.handleCoinBarPressEnd, this);
          this.coinBarNode.off(Node.EventType.TOUCH_END, this.handleCoinMoreTap, this);
          Tween.stopAllByTarget(this.coinBarNode);
        };
        _proto.handleCoinBarPressStart = function handleCoinBarPressStart(event) {
          event.propagationStopped = true;
          if (!this.coinBarNode) {
            return;
          }
          Tween.stopAllByTarget(this.coinBarNode);
          tween(this.coinBarNode).to(0.06, {
            scale: new Vec3(PLAYER_AMOUNT_BAR_SCALE * 0.94, PLAYER_AMOUNT_BAR_SCALE * 0.94, 1)
          }).start();
        };
        _proto.handleCoinBarPressEnd = function handleCoinBarPressEnd(event) {
          event.propagationStopped = true;
          if (!this.coinBarNode) {
            return;
          }
          Tween.stopAllByTarget(this.coinBarNode);
          tween(this.coinBarNode).to(0.08, {
            scale: new Vec3(PLAYER_AMOUNT_BAR_SCALE, PLAYER_AMOUNT_BAR_SCALE, 1)
          }, {
            easing: 'backOut'
          }).start();
        };
        _proto.handleCoinMoreTap = function handleCoinMoreTap(event) {
          var _this$coinMoreHandler;
          event.propagationStopped = true;
          (_this$coinMoreHandler = this.coinMoreHandler) == null || _this$coinMoreHandler.call(this);
        }

        // 金币数值完全来自逻辑层快照，购买技能或领取奖励后会随 renderState 自动刷新。
        ;

        _proto.refreshCoinDisplay = function refreshCoinDisplay() {
          if (this.coinAmountLabel) {
            this.coinAmountLabel.string = Math.max(0, Math.floor(this.currentState.coins)).toLocaleString('en-US');
          }
        }

        // 底部控制栏的视觉样式尽量交给 scene，这里只做异形屏安全区补偿。
        ;

        _proto.configureControlBar = function configureControlBar() {
          var container = this.getControlContainer();
          var rootTransform = this.node.getComponent(UITransform);
          var controlTransform = container.getComponent(UITransform);
          if (!rootTransform || !controlTransform) {
            return;
          }
          var safeArea = sys.getSafeAreaRect();
          var safeBottom = safeArea ? safeArea.y / screen.windowSize.height * rootTransform.height : 0;
          if (this.controlBarBaseHeight <= 0) {
            // 把 scene 中当前控制栏高度记为基准高度，后续不再覆盖编辑器里的布局配置。
            this.controlBarBaseHeight = controlTransform.height;
          }
          var baseHeight = this.controlBarBaseHeight;
          var totalHeight = baseHeight + safeBottom;
          var widget = container.getComponent(Widget);
          if (widget) {
            widget.enabled = false;
          }

          // 参考稿中三个技能卡直接落在草地上，不再使用旧版整块灰色托盘。
          // 只能关闭技能栏的旧托盘，不得在兼容回退时把 Main 背景 Sprite 一起关掉。
          var background = container === this.node ? null : container.getComponent(Sprite);
          if (background) {
            background.enabled = false;
          }

          // 技能栏保持设计稿基准坐标，真机时再整体叠加底部安全区。
          controlTransform.setContentSize(controlTransform.width, totalHeight);
          container.setPosition(0, GAME_SKILLS_Y + safeBottom, 0);
        }

        /**
         * 游戏金币条跟随左侧设置按钮布局。
         * 金币条放在设置按钮右侧并共享水平中线；微信端额外限制右边界，避免侵入原生胶囊。
         */;
        _proto.configureCoinBar = function configureCoinBar() {
          var _coinTransform$width, _this$node$getChildBy2, _this$node$getChildBy3, _settingsNode$getComp2;
          var rootTransform = this.node.getComponent(UITransform);
          if (!this.coinBarNode || !rootTransform) {
            return;
          }
          var coinTransform = this.coinBarNode.getComponent(UITransform);
          var amountBarHalfHeight = PLAYER_AMOUNT_BAR_SOURCE_HEIGHT * PLAYER_AMOUNT_BAR_SCALE * 0.5;
          var amountBarHalfWidth = ((_coinTransform$width = coinTransform == null ? void 0 : coinTransform.width) != null ? _coinTransform$width : 0) * PLAYER_AMOUNT_BAR_SCALE * 0.5;
          var x = PLAYER_AMOUNT_BAR_FALLBACK_X;
          var y = rootTransform.height * 0.5 - PLAYER_AMOUNT_BAR_DEFAULT_TOP_INSET;
          var settingsNode = (_this$node$getChildBy2 = (_this$node$getChildBy3 = this.node.getChildByName('Status')) == null || (_this$node$getChildBy3 = _this$node$getChildBy3.getChildByName('Content')) == null ? void 0 : _this$node$getChildBy3.getChildByName('SettingsBtn')) != null ? _this$node$getChildBy2 : null;
          var settingsTransform = (_settingsNode$getComp2 = settingsNode == null ? void 0 : settingsNode.getComponent(UITransform)) != null ? _settingsNode$getComp2 : null;
          if (settingsNode && settingsTransform) {
            var _settingsNode$getComp3;
            // 主动刷新 Widget，确保首帧读取到的就是异形屏适配后的设置按钮坐标。
            (_settingsNode$getComp3 = settingsNode.getComponent(Widget)) == null || _settingsNode$getComp3.updateAlignment();
            var settingsPosition = rootTransform.convertToNodeSpaceAR(settingsNode.worldPosition);
            x = settingsPosition.x + settingsTransform.width * settingsNode.worldScale.x * 0.5 + PLAYER_AMOUNT_BAR_SETTINGS_GAP + amountBarHalfWidth;
            y = settingsPosition.y;
          }
          var menuMetrics = this.getWechatMenuMetrics();
          if (menuMetrics) {
            var sourceWindowWidth = menuMetrics.windowWidth > 0 ? menuMetrics.windowWidth : screen.windowSize.width;
            var widthScale = rootTransform.width / Math.max(1, sourceWindowWidth);
            var capsuleLeft = -rootTransform.width * 0.5 + menuMetrics.menuRect.left * widthScale;
            x = Math.min(x, capsuleLeft - PLAYER_AMOUNT_BAR_CAPSULE_GAP - amountBarHalfWidth);
          }

          // 兜底时仍保证资源条不会超出画布上下边界。
          y = Math.min(rootTransform.height * 0.5 - amountBarHalfHeight, Math.max(-rootTransform.height * 0.5 + amountBarHalfHeight, y));
          this.coinBarNode.setPosition(x, y, 0);
          this.coinBarNode.setScale(PLAYER_AMOUNT_BAR_SCALE, PLAYER_AMOUNT_BAR_SCALE, 1);
        }

        // 顶部 Status 只在微信小程序里对齐胶囊按钮，其他平台继续使用 scene 中的原始布局。
        ;

        _proto.configureStatusBar = function configureStatusBar() {
          var _this$node$getChildBy4, _statusNode$getCompon2, _statusNode$getCompon3;
          var statusNode = this.node.getChildByName('Status');
          var contentNode = statusNode == null ? void 0 : statusNode.getChildByName('Content');
          var rootTransform = this.node.getComponent(UITransform);
          var contentTransform = contentNode == null ? void 0 : contentNode.getComponent(UITransform);
          if (!statusNode || !contentNode || !rootTransform || !contentTransform) {
            return;
          }

          // HUD 必须位于棋盘和棋子之上、技能栏之下，否则全屏棋盘会抢走设置按钮的触摸事件。
          var skillsNode = (_this$node$getChildBy4 = this.node.getChildByName('SkliisController')) != null ? _this$node$getChildBy4 : this.node.getChildByName('SkillsController');
          if (skillsNode) {
            statusNode.setSiblingIndex(Math.max(0, skillsNode.getSiblingIndex() - 1));
          }
          if (!this.statusContentBasePosition) {
            // Content 的基础位置只记录一次，避免每次布局后都把运行时位置当成新的默认值。
            this.statusContentBasePosition = {
              x: contentNode.position.x,
              y: contentNode.position.y,
              z: contentNode.position.z
            };
          }
          if (!this.statusContentBaseSize) {
            // Content 的基础尺寸同理需要缓存，方便平台切换或调试时恢复。
            this.statusContentBaseSize = {
              width: contentTransform.width,
              height: contentTransform.height
            };
          }
          var basePosition = this.statusContentBasePosition;
          var baseSize = this.statusContentBaseSize;
          if (!baseSize) {
            return;
          }
          if (!basePosition) {
            return;
          }
          var menuMetrics = this.getWechatMenuMetrics();
          if (!menuMetrics) {
            this.restoreStatusBarLayout(contentNode, contentTransform);
            return;
          }
          var sourceWindowHeight = menuMetrics.windowHeight && menuMetrics.windowHeight > 0 ? menuMetrics.windowHeight : screen.windowSize.height;
          var heightScale = rootTransform.height / sourceWindowHeight;
          var contentHeight = baseSize.height;
          var anchorY = contentTransform.anchorPoint.y;
          var capsuleTopFromTop = Math.max(0, menuMetrics.menuRect.top - menuMetrics.screenTop) * heightScale;
          var statusHeight = (_statusNode$getCompon2 = (_statusNode$getCompon3 = statusNode.getComponent(UITransform)) == null ? void 0 : _statusNode$getCompon3.height) != null ? _statusNode$getCompon2 : 0;
          var contentLocalY = statusHeight * 0.5 - capsuleTopFromTop - contentHeight * (1 - anchorY);
          // Content 保留 scene 里的横向位置和尺寸，只把自身距离顶部的偏移改成与胶囊一致。
          contentNode.setPosition(basePosition.x, contentLocalY, basePosition.z);
        }

        // 没有胶囊数据时恢复 scene 默认布局，避免浏览器和编辑器里的排版被微信适配逻辑污染。
        ;

        _proto.restoreStatusBarLayout = function restoreStatusBarLayout(contentNode, contentTransform) {
          if (this.statusContentBaseSize) {
            contentTransform.setContentSize(this.statusContentBaseSize.width, this.statusContentBaseSize.height);
          }
          if (this.statusContentBasePosition) {
            contentNode.setPosition(this.statusContentBasePosition.x, this.statusContentBasePosition.y, this.statusContentBasePosition.z);
          }
        }

        // 微信小程序和小游戏里，胶囊矩形需要和窗口信息一起读取，才能消掉真机顶部原生偏移。
        ;

        _proto.getWechatMenuMetrics = function getWechatMenuMetrics() {
          var _windowInfo$windowWid, _windowInfo$windowHei, _windowInfo$screenTop;
          var wxApi = globalThis.wx;
          if (!wxApi || typeof wxApi.getMenuButtonBoundingClientRect !== 'function') {
            return null;
          }
          var menuRect = wxApi.getMenuButtonBoundingClientRect();
          if (!menuRect || menuRect.width <= 0 || menuRect.height <= 0) {
            return null;
          }
          var windowInfo = typeof wxApi.getWindowInfo === 'function' ? wxApi.getWindowInfo() : typeof wxApi.getSystemInfoSync === 'function' ? wxApi.getSystemInfoSync() : null;
          return {
            menuRect: menuRect,
            windowWidth: (_windowInfo$windowWid = windowInfo == null ? void 0 : windowInfo.windowWidth) != null ? _windowInfo$windowWid : 0,
            windowHeight: (_windowInfo$windowHei = windowInfo == null ? void 0 : windowInfo.windowHeight) != null ? _windowInfo$windowHei : 0,
            screenTop: (_windowInfo$screenTop = windowInfo == null ? void 0 : windowInfo.screenTop) != null ? _windowInfo$screenTop : 0
          };
        }

        // 把当前逻辑状态翻译成状态栏文本。
        // private refreshStatus() {
        //   if (!this.statusLabel) {
        //     return
        //   }

        //   if (this.currentState.isGameOver) {
        //     this.statusLabel.string = 'Game Over - Tap to restart'
        //     return
        //   }

        //   if (this.currentState.isResolving) {
        //     this.statusLabel.string = 'Resolving...'
        //     return
        //   }

        //   if (this.currentState.isPaused) {
        //     this.statusLabel.string = 'Paused'
        //     return
        //   }

        //   if (!this.currentState.currentValue) {
        //     this.statusLabel.string = ''
        //     return
        //   }

        //   this.statusLabel.string = `Current ${this.currentState.currentValue} - Drag to choose column, tap to fast drop until landing`
        // }

        // 根据 paused 状态刷新按钮文案和颜色。
        // private refreshPauseButton() {
        //   if (!this.pauseButtonLabel) {
        //     return
        //   }

        //   this.pauseButtonLabel.string = this.currentState.isPaused ? 'Resume' : 'Pause'
        //   const bg = this.pauseButtonLabel.node.parent?.getComponent(Sprite)
        //   if (bg) {
        //     bg.color = this.currentState.isPaused ? new Color(73, 111, 83, 240) : new Color(37, 55, 80, 235)
        //   }
        // }

        // 暂停按钮只负责把点击事件转交给逻辑层，避免 UI 层直接改状态。
        ;

        _proto.onPauseButtonTap = function onPauseButtonTap(event) {
          var _this$pauseHandler;
          event.propagationStopped = true;
          (_this$pauseHandler = this.pauseHandler) == null || _this$pauseHandler.call(this);
        }

        // 技能按钮节点来自 scene 层级，UI 层只负责绑定点击事件和表现选中状态。
        ;

        _proto.ensureSkillButtons = function ensureSkillButtons() {
          var _skillsContainer$getC, _skillsContainer$getC2, _skillsContainer$getC3;
          var skillsContainer = this.getSkillsContainer();
          this.bombSkillNode = (_skillsContainer$getC = skillsContainer == null ? void 0 : skillsContainer.getChildByName('Skill1')) != null ? _skillsContainer$getC : null;
          this.hammerSkillNode = (_skillsContainer$getC2 = skillsContainer == null ? void 0 : skillsContainer.getChildByName('Skill2')) != null ? _skillsContainer$getC2 : null;
          this.swapSkillNode = (_skillsContainer$getC3 = skillsContainer == null ? void 0 : skillsContainer.getChildByName('Skill3')) != null ? _skillsContainer$getC3 : null;
          if (this.bombSkillNode) {
            this.bombSkillNode.off(Node.EventType.TOUCH_END, this.onBombSkillButtonTap, this);
            this.bombSkillNode.on(Node.EventType.TOUCH_END, this.onBombSkillButtonTap, this);
            this.ensureSkillCardVisual(this.bombSkillNode, 'bomb');
            this.skillCountSprites.bomb = this.ensureSkillCountSprite(this.bombSkillNode);
            this.ensureSkillStateDecorations(this.bombSkillNode);
          }
          if (this.hammerSkillNode) {
            this.hammerSkillNode.off(Node.EventType.TOUCH_END, this.onHammerSkillButtonTap, this);
            this.hammerSkillNode.on(Node.EventType.TOUCH_END, this.onHammerSkillButtonTap, this);
            this.ensureSkillCardVisual(this.hammerSkillNode, 'hammer');
            this.skillCountSprites.hammer = this.ensureSkillCountSprite(this.hammerSkillNode);
            this.ensureSkillStateDecorations(this.hammerSkillNode);
          }
          if (!this.swapSkillNode) {
            return;
          }
          this.swapSkillNode.off(Node.EventType.TOUCH_END, this.onSwapSkillButtonTap, this);
          this.swapSkillNode.on(Node.EventType.TOUCH_END, this.onSwapSkillButtonTap, this);
          this.ensureSkillCardVisual(this.swapSkillNode, 'swap');
          this.skillCountSprites.swap = this.ensureSkillCountSprite(this.swapSkillNode);
          this.ensureSkillStateDecorations(this.swapSkillNode);
        }

        /** 把历史圆形技能按钮收口为设计稿的方形手绘卡片。 */;
        _proto.ensureSkillCardVisual = function ensureSkillCardVisual(skillNode, skill) {
          var _skillNode$getCompone, _cardNode$getComponen, _labelNode$getCompone;
          var rootTransform = (_skillNode$getCompone = skillNode.getComponent(UITransform)) != null ? _skillNode$getCompone : skillNode.addComponent(UITransform);
          rootTransform.setContentSize(108, 114);
          var cardNode = skillNode.getChildByName('Card');
          if (!cardNode) {
            cardNode = new Node('Card');
            cardNode.setParent(skillNode);
            cardNode.addComponent(UITransform);
            cardNode.addComponent(Graphics);
          }
          cardNode.setPosition(0, -1, 0);
          cardNode.setSiblingIndex(0);
          (_cardNode$getComponen = cardNode.getComponent(UITransform)) == null || _cardNode$getComponen.setContentSize(96, 104);
          var card = cardNode.getComponent(Graphics);
          if (card) {
            card.clear();
            card.fillColor = SKILL_CARD_BORDER_COLOR;
            card.roundRect(-48, -52, 96, 104, 13);
            card.fill();
            card.fillColor = SKILL_CARD_INNER_COLORS[skill];
            card.roundRect(-45, -49, 90, 98, 10);
            card.fill();
            card.fillColor = new Color(255, 248, 220, 34);
            card.roundRect(-41, 19, 82, 24, 7);
            card.fill();
          }
          var iconName = skill === 'bomb' ? 'BombBtn' : skill === 'hammer' ? 'HammerBtn' : 'V_RocketBtn';
          var iconNode = skillNode.getChildByName(iconName);
          if (iconNode) {
            var _iconNode$getComponen3;
            iconNode.setPosition(0, 13, 0);
            (_iconNode$getComponen3 = iconNode.getComponent(UITransform)) == null || _iconNode$getComponen3.setContentSize(52, 52);
            var icon = iconNode.getComponent(Sprite);
            if (icon) {
              icon.sizeMode = Sprite.SizeMode.CUSTOM;
              icon.trim = false;
              assetManager.loadAny(SKILL_ICON_SPRITE_FRAME_UUIDS[skill], function (error, asset) {
                if (!error && icon.node.isValid && asset instanceof SpriteFrame) {
                  icon.spriteFrame = asset;
                  icon.sizeMode = Sprite.SizeMode.CUSTOM;
                  var iconTransform = icon.node.getComponent(UITransform);
                  iconTransform == null || iconTransform.setContentSize(52, 52);
                }
              });
            }
            iconNode.setSiblingIndex(Math.min(1, skillNode.children.length - 1));
          }
          var labelNode = skillNode.getChildByName('Name');
          if (!labelNode) {
            labelNode = new Node('Name');
            labelNode.setParent(skillNode);
            labelNode.addComponent(UITransform);
            labelNode.addComponent(Label);
          }
          labelNode.setPosition(0, -36, 0);
          (_labelNode$getCompone = labelNode.getComponent(UITransform)) == null || _labelNode$getCompone.setContentSize(88, 27);
          labelNode.setSiblingIndex(Math.min(2, skillNode.children.length - 1));
          var label = labelNode.getComponent(Label);
          if (label) {
            label.string = SKILL_CARD_LABELS[skill];
            label.fontSize = 18;
            label.lineHeight = 22;
            label.color = new Color(255, 250, 230, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.isBold = true;
            label.enableOutline = true;
            label.outlineColor = new Color(75, 53, 40, 240);
            label.outlineWidth = 2;
          }
          var boxNode = this.getSkillBox(skillNode);
          boxNode.setSiblingIndex(skillNode.children.length - 1);
          for (var _i = 0, _arr = ['MoreBtn', 'AmountBG', 'Count']; _i < _arr.length; _i++) {
            var _boxNode$getChildByNa;
            var badgeName = _arr[_i];
            var badgeNode = boxNode.getChildByName(badgeName);
            badgeNode == null || badgeNode.setPosition(39, 41, 0);
            var badgeSprite = badgeNode == null ? void 0 : badgeNode.getComponent(Sprite);
            if (badgeSprite) {
              badgeSprite.enabled = false;
            }
          }
          this.ensureSkillCountBadge(skillNode);
        };
        _proto.ensureSkillCountBadge = function ensureSkillCountBadge(skillNode) {
          var badgeNode = skillNode.getChildByName('CountBadge');
          if (!badgeNode) {
            badgeNode = new Node('CountBadge');
            badgeNode.setParent(skillNode);
            badgeNode.addComponent(UITransform).setContentSize(40, 40);
            badgeNode.addComponent(Graphics);
          }
          badgeNode.setPosition(39, 41, 0);
          badgeNode.setSiblingIndex(skillNode.children.length - 1);
          var badge = badgeNode.getComponent(Graphics);
          if (badge) {
            badge.clear();
            badge.fillColor = HUD_CARD_BORDER_COLOR;
            badge.circle(0, 0, 20);
            badge.fill();
            badge.fillColor = new Color(92, 170, 47, 255);
            badge.circle(0, 0, 17);
            badge.fill();
          }
          var label = this.ensureHudLabel(badgeNode, 'Value', '1', 0, 0, 34, 32, 19, new Color(255, 255, 246, 255));
          label.enableOutline = false;
        };
        _proto.ensureSkillStateDecorations = function ensureSkillStateDecorations(skillNode) {
          var ringNode = skillNode.getChildByName('SelectionRing');
          if (!ringNode) {
            ringNode = new Node('SelectionRing');
            ringNode.setParent(skillNode);
            ringNode.addComponent(UITransform).setContentSize(112, 120);
            ringNode.addComponent(Graphics);
          }
          ringNode.setPosition(0, 0, 0);
          ringNode.setSiblingIndex(0);
          ringNode.active = false;
          var ring = ringNode.getComponent(Graphics);
          if (ring) {
            ring.clear();
            ring.lineWidth = 6;
            ring.strokeColor = SKILL_SELECTION_COLOR;
            ring.roundRect(-54, -58, 108, 116, 18);
            ring.stroke();
          }
          var usedNode = skillNode.getChildByName('UsedLabel');
          if (!usedNode) {
            usedNode = new Node('UsedLabel');
            usedNode.setParent(skillNode);
            usedNode.addComponent(UITransform).setContentSize(72, 32);
            usedNode.addComponent(Graphics);
            usedNode.addComponent(Label);
          }
          usedNode.setPosition(0, 0, 0);
          usedNode.active = false;
          var usedBg = usedNode.getComponent(Graphics);
          if (usedBg) {
            usedBg.clear();
            usedBg.fillColor = new Color(61, 57, 52, 224);
            usedBg.roundRect(-36, -16, 72, 32, 14);
            usedBg.fill();
          }
          var usedLabel = usedNode.getComponent(Label);
          if (usedLabel) {
            usedLabel.string = '已用';
            usedLabel.fontSize = 19;
            usedLabel.lineHeight = 24;
            usedLabel.color = new Color(255, 248, 221, 255);
            usedLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            usedLabel.verticalAlign = Label.VerticalAlign.CENTER;
            usedLabel.isBold = true;
          }
        }

        // 技能数量节点固定在 Box 里；旧场景还没迁移 Box 时，临时兼容直接挂在 Skill 下的节点。
        ;

        _proto.getSkillBox = function getSkillBox(skillNode) {
          var _skillNode$getChildBy;
          return (_skillNode$getChildBy = skillNode.getChildByName('Box')) != null ? _skillNode$getChildBy : skillNode;
        }

        // Count 是数字图片节点，不再使用 Label 文本，样式由场景里的节点尺寸和位置决定。
        ;

        _proto.ensureSkillCountSprite = function ensureSkillCountSprite(skillNode) {
          var _countNode$getCompone;
          var boxNode = this.getSkillBox(skillNode);
          if (boxNode !== skillNode) {
            boxNode.setSiblingIndex(skillNode.children.length - 1);
          }
          this.ensureSkillBoxChild(boxNode, 'MoreBtn');
          this.ensureSkillBoxChild(boxNode, 'AmountBG');
          var countNode = this.ensureSkillBoxChild(boxNode, 'Count');
          this.syncSkillBoxLayer(boxNode);
          return (_countNode$getCompone = countNode.getComponent(Sprite)) != null ? _countNode$getCompone : countNode.addComponent(Sprite);
        }

        // 三个技能的角标结构共用一套逻辑，缺失的节点从其它技能复制图片和尺寸，位置贴当前技能已有角标。
        ;

        _proto.ensureSkillBoxChild = function ensureSkillBoxChild(boxNode, nodeName) {
          var _ref3, _ref4, _positionReferenceNod, _positionReferenceNod2, _positionReferenceNod3, _ref5, _referenceTransform$w, _referenceTransform$h, _referenceNode$getCom, _referenceNode$getCom2;
          var currentNode = boxNode.getChildByName(nodeName);
          if (currentNode) {
            return currentNode;
          }
          var referenceNode = this.findSkillBoxChild(nodeName, boxNode);
          var localMoreButtonNode = boxNode.getChildByName('MoreBtn');
          var positionReferenceNode = (_ref3 = (_ref4 = localMoreButtonNode != null ? localMoreButtonNode : boxNode.getChildByName('Count')) != null ? _ref4 : boxNode.getChildByName('AmountBG')) != null ? _ref3 : referenceNode;
          var node = new Node(nodeName);
          node.setParent(boxNode);
          node.setPosition((_positionReferenceNod = positionReferenceNode == null ? void 0 : positionReferenceNode.position.x) != null ? _positionReferenceNod : SKILL_BADGE_FALLBACK_X, (_positionReferenceNod2 = positionReferenceNode == null ? void 0 : positionReferenceNode.position.y) != null ? _positionReferenceNod2 : SKILL_BADGE_FALLBACK_Y, (_positionReferenceNod3 = positionReferenceNode == null ? void 0 : positionReferenceNode.position.z) != null ? _positionReferenceNod3 : 0);
          var transform = node.addComponent(UITransform);
          var referenceTransform = (_ref5 = nodeName === 'AmountBG' ? localMoreButtonNode : referenceNode) == null ? void 0 : _ref5.getComponent(UITransform);
          transform.setContentSize((_referenceTransform$w = referenceTransform == null ? void 0 : referenceTransform.width) != null ? _referenceTransform$w : nodeName === 'Count' ? SKILL_COUNT_WIDTH : SKILL_BADGE_FALLBACK_SIZE, (_referenceTransform$h = referenceTransform == null ? void 0 : referenceTransform.height) != null ? _referenceTransform$h : nodeName === 'Count' ? SKILL_COUNT_HEIGHT : SKILL_BADGE_FALLBACK_SIZE);
          var sprite = node.addComponent(Sprite);
          var referenceSpriteFrame = (_referenceNode$getCom = referenceNode == null || (_referenceNode$getCom2 = referenceNode.getComponent(Sprite)) == null ? void 0 : _referenceNode$getCom2.spriteFrame) != null ? _referenceNode$getCom : null;
          if (referenceSpriteFrame) {
            sprite.spriteFrame = referenceSpriteFrame;
          }
          sprite.sizeMode = Sprite.SizeMode.CUSTOM;
          return node;
        }

        // 从其它技能上找同名角标节点，保证 Skill1/Skill2/Skill3 缺图时可以复用同一套视觉资源。
        ;

        _proto.findSkillBoxChild = function findSkillBoxChild(nodeName, ignoredBoxNode) {
          var skillNodes = [this.bombSkillNode, this.hammerSkillNode, this.swapSkillNode];
          for (var _i2 = 0, _skillNodes = skillNodes; _i2 < _skillNodes.length; _i2++) {
            var _boxNode$getChildByNa2;
            var skillNode = _skillNodes[_i2];
            var boxNode = skillNode ? this.getSkillBox(skillNode) : null;
            var childNode = (_boxNode$getChildByNa2 = boxNode == null ? void 0 : boxNode.getChildByName(nodeName)) != null ? _boxNode$getChildByNa2 : null;
            if (boxNode && boxNode !== ignoredBoxNode && childNode) {
              return childNode;
            }
          }
          return null;
        }

        // AmountBG 必须在 Count 下层；这里只调整同父节点下的渲染顺序，不改坐标、尺寸、缩放。
        ;

        _proto.syncSkillBoxLayer = function syncSkillBoxLayer(boxNode) {
          var moreButtonNode = boxNode.getChildByName('MoreBtn');
          var amountBgNode = boxNode.getChildByName('AmountBG');
          var countNode = boxNode.getChildByName('Count');
          if (amountBgNode) {
            amountBgNode.setSiblingIndex(boxNode.children.length - 1);
          }
          if (moreButtonNode) {
            moreButtonNode.setSiblingIndex(boxNode.children.length - 1);
          }
          if (countNode) {
            countNode.setSiblingIndex(boxNode.children.length - 1);
          }
        }

        // 反馈层集中容纳技能提示和 Toast，避免临时节点散落在 Main 根节点。
        ;

        _proto.ensureFeedbackLayer = function ensureFeedbackLayer() {
          var _layer$getComponent2, _rootTransform$width, _rootTransform$height;
          var layer = this.node.getChildByName('FeedbackLayer');
          if (!layer) {
            layer = new Node('FeedbackLayer');
            layer.setParent(this.node);
            layer.addComponent(UITransform);
          }
          var rootTransform = this.node.getComponent(UITransform);
          var layerTransform = (_layer$getComponent2 = layer.getComponent(UITransform)) != null ? _layer$getComponent2 : layer.addComponent(UITransform);
          layerTransform.setContentSize((_rootTransform$width = rootTransform == null ? void 0 : rootTransform.width) != null ? _rootTransform$width : 750, (_rootTransform$height = rootTransform == null ? void 0 : rootTransform.height) != null ? _rootTransform$height : 1334);
          layer.setPosition(0, 0, 0);
          this.feedbackLayer = layer;
        };
        _proto.ensureToast = function ensureToast() {
          var _this$feedbackLayer, _toast$getComponent, _toast$getComponent2;
          var parent = (_this$feedbackLayer = this.feedbackLayer) != null ? _this$feedbackLayer : this.node;
          var toast = parent.getChildByName('Toast');
          if (!toast) {
            toast = new Node('Toast');
            toast.setParent(parent);
            toast.addComponent(UITransform);
          }
          toast.active = false;
          toast.setPosition(0, -360, 0);
          (_toast$getComponent = toast.getComponent(UITransform)) == null || _toast$getComponent.setContentSize(500, 64);
          this.drawFeedbackBubble(toast, 500, 64, new Color(54, 75, 71, 235), new Color(255, 248, 220, 245));
          this.toastNode = toast;
          this.toastOpacity = (_toast$getComponent2 = toast.getComponent(UIOpacity)) != null ? _toast$getComponent2 : toast.addComponent(UIOpacity);
          var label = this.ensureFeedbackLabel(toast, 'Text', 23);
          label.string = '';
        }

        // 技能模式提示放在技能栏上方，明确告诉玩家可以拖动交换，也可以再次点击取消。
        ;

        _proto.ensureSkillHint = function ensureSkillHint() {
          var _this$feedbackLayer2, _hintNode$getComponen, _label$node$getCompon;
          var parent = (_this$feedbackLayer2 = this.feedbackLayer) != null ? _this$feedbackLayer2 : this.node;
          var hintNode = parent.getChildByName('SkillModeHint');
          if (!hintNode) {
            hintNode = new Node('SkillModeHint');
            hintNode.setParent(parent);
            hintNode.addComponent(UITransform).setContentSize(520, 48);
          }
          hintNode.active = false;
          hintNode.setScale(Vec3.ONE);
          this.skillHintNode = hintNode;
          this.skillHintOpacity = (_hintNode$getComponen = hintNode.getComponent(UIOpacity)) != null ? _hintNode$getComponen : hintNode.addComponent(UIOpacity);
          this.skillHintOpacity.opacity = 0;
          this.drawFeedbackBubble(hintNode, 520, 48, new Color(74, 47, 20, 224), new Color(255, 244, 196, 238));
          var label = this.ensureFeedbackLabel(hintNode, 'Text', 23);
          label.string = '拖动相邻棋子交换，再点技能取消';
          label.color = new Color(255, 246, 210, 255);
          // 给提示文字加深色描边，保证在棋盘、背景和技能栏上方都能清楚识别。
          var outline = (_label$node$getCompon = label.node.getComponent(LabelOutline)) != null ? _label$node$getCompon : label.node.addComponent(LabelOutline);
          outline.color = new Color(64, 38, 8, 255);
          outline.width = 2;
        };
        _proto.ensureFeedbackLabel = function ensureFeedbackLabel(parent, name, fontSize) {
          var _node$getComponent4, _parentTransform$widt, _parentTransform$heig, _node$getComponent5;
          var node = parent.getChildByName(name);
          if (!node) {
            node = new Node(name);
            node.setParent(parent);
            node.addComponent(UITransform);
            node.addComponent(Label);
          }
          node.setPosition(0, 0, 0);
          var parentTransform = parent.getComponent(UITransform);
          (_node$getComponent4 = node.getComponent(UITransform)) == null || _node$getComponent4.setContentSize(Math.max(0, ((_parentTransform$widt = parentTransform == null ? void 0 : parentTransform.width) != null ? _parentTransform$widt : 500) - 30), Math.max(0, ((_parentTransform$heig = parentTransform == null ? void 0 : parentTransform.height) != null ? _parentTransform$heig : 56) - 8));
          var label = (_node$getComponent5 = node.getComponent(Label)) != null ? _node$getComponent5 : node.addComponent(Label);
          label.fontSize = fontSize;
          label.lineHeight = Math.ceil(fontSize * 1.25);
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
          label.isBold = true;
          return label;
        };
        _proto.drawFeedbackBubble = function drawFeedbackBubble(node, width, height, border, fill) {
          var _node$getComponent6;
          var graphics = (_node$getComponent6 = node.getComponent(Graphics)) != null ? _node$getComponent6 : node.addComponent(Graphics);
          graphics.clear();
          graphics.fillColor = border;
          graphics.roundRect(-width * 0.5, -height * 0.5, width, height, height * 0.5);
          graphics.fill();
          graphics.fillColor = fill;
          graphics.roundRect(-width * 0.5 + 3, -height * 0.5 + 3, width - 6, height - 6, height * 0.5 - 3);
          graphics.fill();
        }

        // 第一个技能当前定义为炸弹技能，点击后进入点选爆炸中心模式。
        ;

        _proto.onBombSkillButtonTap = function onBombSkillButtonTap(event) {
          var _this$bombSkillHandle;
          event.propagationStopped = true;
          (_this$bombSkillHandle = this.bombSkillHandler) == null || _this$bombSkillHandle.call(this);
        }

        // 第二个技能当前定义为锤子技能，点击后进入点选敲碎模式。
        ;

        _proto.onHammerSkillButtonTap = function onHammerSkillButtonTap(event) {
          var _this$hammerSkillHand;
          event.propagationStopped = true;
          (_this$hammerSkillHand = this.hammerSkillHandler) == null || _this$hammerSkillHand.call(this);
        }

        // 第三个技能当前定义为交换技能，点击后只把意图交给 PlayController 处理。
        ;

        _proto.onSwapSkillButtonTap = function onSwapSkillButtonTap(event) {
          var _this$swapSkillHandle;
          event.propagationStopped = true;
          (_this$swapSkillHandle = this.swapSkillHandler) == null || _this$swapSkillHandle.call(this);
        }

        // 三个技能统一刷新选中、库存为空和本局已使用状态。
        ;

        _proto.refreshSkillButtonState = function refreshSkillButtonState() {
          this.refreshSingleSkillVisual('bomb', this.bombSkillNode);
          this.refreshSingleSkillVisual('hammer', this.hammerSkillNode);
          this.refreshSingleSkillVisual('swap', this.swapSkillNode);
          this.refreshSkillCountDisplay();
          this.refreshSkillHintState(this.currentState.activeSkill);
        };
        _proto.refreshSingleSkillVisual = function refreshSingleSkillVisual(skill, skillNode) {
          var _skillNode$getCompone2;
          if (!skillNode) {
            return;
          }
          var isActive = this.currentState.activeSkill === skill;
          var isUsed = this.currentState.skillUsed[skill];
          var count = Math.max(0, this.currentState.skillCounts[skill]);
          var visualKey = isActive + "-" + isUsed + "-" + count;
          skillNode.getChildByName('SelectionRing').active = isActive && !isUsed && count > 0;
          skillNode.getChildByName('UsedLabel').active = isUsed;
          var opacity = (_skillNode$getCompone2 = skillNode.getComponent(UIOpacity)) != null ? _skillNode$getCompone2 : skillNode.addComponent(UIOpacity);
          opacity.opacity = isUsed ? SKILL_DISABLED_OPACITY : count <= 0 ? SKILL_EMPTY_OPACITY : 255;
          if (this.skillVisualKeys[skill] === visualKey) {
            return;
          }
          this.skillVisualKeys[skill] = visualKey;
          Tween.stopAllByTarget(skillNode);
          tween(skillNode).to(0.1, {
            scale: isActive ? new Vec3(1.05, 1.05, 1) : Vec3.ONE
          }, {
            easing: 'quadOut'
          }).start();
        }

        // 技能库存使用小角标展示，库存为零时显示加号，本局已使用仍保留库存但整体置灰。
        ;

        _proto.refreshSkillCountDisplay = function refreshSkillCountDisplay() {
          this.refreshSingleSkillCount('bomb', this.bombSkillNode);
          this.refreshSingleSkillCount('hammer', this.hammerSkillNode);
          this.refreshSingleSkillCount('swap', this.swapSkillNode);
        };
        _proto.refreshSingleSkillCount = function refreshSingleSkillCount(skill, skillNode) {
          var hasUsedThisGame = this.currentState.skillUsed[skill];
          if (!skillNode) {
            return;
          }
          var boxNode = this.getSkillBox(skillNode);
          var moreButtonNode = boxNode.getChildByName('MoreBtn');
          var amountBgNode = boxNode.getChildByName('AmountBG');
          var countNode = boxNode.getChildByName('Count');
          var count = Math.max(0, Math.floor(this.currentState.skillCounts[skill]));
          var hasStock = count > 0;
          var customBadge = skillNode.getChildByName('CountBadge');
          var customBadgeLabelNode = customBadge == null ? void 0 : customBadge.getChildByName('Value');
          var customBadgeLabel = customBadgeLabelNode == null ? void 0 : customBadgeLabelNode.getComponent(Label);
          if (customBadge) {
            customBadge.active = hasStock;
          }
          if (customBadgeLabel) {
            customBadgeLabel.string = count >= 10 ? '9+' : "" + count;
          }
          if (moreButtonNode) {
            moreButtonNode.active = !hasStock && !hasUsedThisGame;
          }
          if (amountBgNode) {
            amountBgNode.active = false;
          }
          if (countNode) {
            var _countNode$getCompone2;
            countNode.active = false;
            var countSprite = (_countNode$getCompone2 = countNode.getComponent(Sprite)) != null ? _countNode$getCompone2 : countNode.addComponent(Sprite);
            var spriteFrame = this.getCounterNumberSpriteFrame(count);
            countSprite.spriteFrame = spriteFrame;
            countSprite.enabled = !!spriteFrame;
            countSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            var fallback = this.ensureSkillCountFallback(countNode);
            fallback.node.active = !spriteFrame;
            fallback.string = count >= 10 ? '9+' : "" + count;
          }
        };
        _proto.ensureSkillCountFallback = function ensureSkillCountFallback(countNode) {
          var _fallbackNode$getComp;
          var fallbackNode = countNode.getChildByName('FallbackLabel');
          if (!fallbackNode) {
            fallbackNode = new Node('FallbackLabel');
            fallbackNode.setParent(countNode);
            fallbackNode.addComponent(UITransform).setContentSize(28, 24);
            fallbackNode.addComponent(Label);
          }
          fallbackNode.setPosition(0, 0, 0);
          var label = (_fallbackNode$getComp = fallbackNode.getComponent(Label)) != null ? _fallbackNode$getComp : fallbackNode.addComponent(Label);
          label.fontSize = 17;
          label.lineHeight = 20;
          label.color = new Color(255, 255, 255, 255);
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
          label.isBold = true;
          return label;
        }

        // counterNumberSpriteFrames 里的图片以 0-9 命名，优先按名字找，找不到时用下标兜底。
        ;

        _proto.getCounterNumberSpriteFrame = function getCounterNumberSpriteFrame(count) {
          var _ref6, _this$counterNumberSp;
          var displayCount = Math.min(9, Math.max(0, count));
          var displayName = "" + displayCount;
          return (_ref6 = (_this$counterNumberSp = this.counterNumberSpriteFrames.find(function (spriteFrame) {
            return (spriteFrame == null ? void 0 : spriteFrame.name) === displayName;
          })) != null ? _this$counterNumberSp : this.counterNumberSpriteFrames[displayCount]) != null ? _ref6 : null;
        }

        // 技能激活时提示常驻并轻微呼吸，取消或施放结束时淡出。
        ;

        _proto.refreshSkillHintState = function refreshSkillHintState(activeSkill) {
          var _this5 = this;
          var isActive = activeSkill !== null;
          if (!this.skillHintNode || !this.skillHintOpacity) {
            return;
          }
          this.refreshSkillHintText(activeSkill);
          if (this.isSkillHintVisible === isActive) {
            return;
          }
          this.isSkillHintVisible = isActive;
          Tween.stopAllByTarget(this.skillHintNode);
          Tween.stopAllByTarget(this.skillHintOpacity);
          if (isActive) {
            this.updateSkillHintLayout();
            this.skillHintNode.active = true;
            this.skillHintNode.setScale(new Vec3(0.96, 0.96, 1));
            this.skillHintOpacity.opacity = 0;
            tween(this.skillHintOpacity).to(0.12, {
              opacity: 255
            }, {
              easing: 'quadOut'
            }).start();
            tween(this.skillHintNode).sequence(tween().to(0.12, {
              scale: Vec3.ONE
            }, {
              easing: 'backOut'
            }), tween().repeatForever(tween().sequence(tween().to(0.48, {
              scale: new Vec3(1.04, 1.04, 1)
            }, {
              easing: 'sineInOut'
            }), tween().to(0.48, {
              scale: Vec3.ONE
            }, {
              easing: 'sineInOut'
            })))).start();
            return;
          }
          tween(this.skillHintOpacity).to(0.1, {
            opacity: 0
          }, {
            easing: 'quadIn'
          }).call(function () {
            if (_this5.skillHintNode) {
              _this5.skillHintNode.active = false;
              _this5.skillHintNode.setScale(Vec3.ONE);
            }
          }).start();
        }

        // 不同技能使用同一个提示节点，文案随当前激活技能切换。
        ;

        _proto.refreshSkillHintText = function refreshSkillHintText(activeSkill) {
          var _this$skillHintNode$g, _this$skillHintNode$g2;
          if (!this.skillHintNode || !activeSkill) {
            return;
          }
          var label = (_this$skillHintNode$g = (_this$skillHintNode$g2 = this.skillHintNode.getChildByName('Text')) == null ? void 0 : _this$skillHintNode$g2.getComponent(Label)) != null ? _this$skillHintNode$g : null;
          if (!label) {
            return;
          }
          label.string = activeSkill === 'bomb' ? '点选中心棋子，炸碎周围棋子' : activeSkill === 'hammer' ? '点选一个棋子敲碎，再点技能取消' : '拖动相邻棋子交换，再点技能取消';
        }

        // 提示位置跟随技能栏，避免异形屏或 scene 调整后提示跑到错误位置。
        ;

        _proto.updateSkillHintLayout = function updateSkillHintLayout() {
          if (!this.skillHintNode) {
            return;
          }
          var skillsContainer = this.getSkillsContainer();
          if (!skillsContainer) {
            this.skillHintNode.setPosition(0, -400, 0);
            return;
          }
          this.skillHintNode.setPosition(skillsContainer.position.x, skillsContainer.position.y + 120, 0);
        }

        // 技能栏节点历史上有拼写错误，这里同时兼容新旧两个名字。
        ;

        _proto.getSkillsContainer = function getSkillsContainer() {
          var _this$node$getChildBy5;
          return (_this$node$getChildBy5 = this.node.getChildByName('SkliisController')) != null ? _this$node$getChildBy5 : this.node.getChildByName('SkillsController');
        }

        // 切场景返回首页时，节点引用可能非空但已进入销毁态，调用事件接口前必须确认仍有效。
        ;

        _proto.canUseNode = function canUseNode(node) {
          return !!node && node.isValid;
        };
        _proto.safeOff = function safeOff(node, eventType, handler) {
          if (!this.canUseNode(node)) {
            return;
          }
          node.off(eventType, handler, this);
        }

        // 优先复用 scene 中已有的 Controller 节点，方便继续在层级管理器里调样式。
        ;

        _proto.getControlContainer = function getControlContainer() {
          var _ref7, _this$node$getChildBy6;
          return (_ref7 = (_this$node$getChildBy6 = this.node.getChildByName('Controller')) != null ? _this$node$getChildBy6 : this.getSkillsContainer()) != null ? _ref7 : this.node;
        }

        // 读取棋盘内区宽度，优先使用 BoardFill 的尺寸，避免和逻辑层出现偏差。
        ;

        _proto.getBoardInnerWidth = function getBoardInnerWidth() {
          var _this$node$getChildBy7, _this$node$getChildBy8;
          var fillTransform = (_this$node$getChildBy7 = this.node.getChildByName('board')) == null || (_this$node$getChildBy7 = _this$node$getChildBy7.getChildByName('BoardFill')) == null ? void 0 : _this$node$getChildBy7.getComponent(UITransform);
          if (fillTransform) {
            return fillTransform.width;
          }
          var boardTransform = (_this$node$getChildBy8 = this.node.getChildByName('board')) == null ? void 0 : _this$node$getChildBy8.getComponent(UITransform);
          if (boardTransform) {
            return boardTransform.width - BOARD_BORDER_WIDTH * 2;
          }
          return this.boardwidth * (this.pieceSize + this.spacing);
        }

        // 读取棋盘内区高度，优先使用 BoardFill 的尺寸，保证 UI 与逻辑共用一套内区。
        ;

        _proto.getBoardInnerHeight = function getBoardInnerHeight() {
          var _this$node$getChildBy9, _this$node$getChildBy10;
          var fillTransform = (_this$node$getChildBy9 = this.node.getChildByName('board')) == null || (_this$node$getChildBy9 = _this$node$getChildBy9.getChildByName('BoardFill')) == null ? void 0 : _this$node$getChildBy9.getComponent(UITransform);
          if (fillTransform) {
            return fillTransform.height;
          }
          var boardTransform = (_this$node$getChildBy10 = this.node.getChildByName('board')) == null ? void 0 : _this$node$getChildBy10.getComponent(UITransform);
          if (boardTransform) {
            return boardTransform.height - BOARD_BORDER_WIDTH * 2;
          }
          return this.boardheight * (this.pieceSize + this.spacing);
        }

        // 根据棋盘内区宽度计算每一列的中心点。
        ;

        _proto.getBoardColumnCenterX = function getBoardColumnCenterX(column) {
          var columnWidth = this.getBoardInnerWidth() / this.boardwidth;
          return -this.getBoardInnerWidth() / 2 + columnWidth * (column + 0.5);
        }

        // 根据棋盘内区宽度计算列分隔线的位置。
        ;

        _proto.getBoardSeparatorX = function getBoardSeparatorX(column) {
          var columnWidth = this.getBoardInnerWidth() / this.boardwidth;
          return -this.getBoardInnerWidth() / 2 + columnWidth * (column + 1);
        };
        return PlayUIController;
      }(Component)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/ScoreManager.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      cclegacy._RF.push({}, "9f23aZ6LwJJIaOBwtCocU2y", "ScoreManager", undefined);
      // 分数规则集中管理，PlayController 只需要在合并和重开时通知它。
      var ScoreManager = exports('ScoreManager', /*#__PURE__*/function () {
        function ScoreManager() {
          this.bonusScore = 0;
          this.highestPieceValue = 0;
        }
        var _proto = ScoreManager.prototype;
        _proto.reset = function reset() {
          this.bonusScore = 0;
          this.highestPieceValue = 0;
        }

        // 从跨场景快照恢复累计奖励和历史最高值，续局时不重新计算已发生的合并奖励。
        ;

        _proto.restore = function restore(bonusScore, highestPieceValue) {
          this.bonusScore = Math.max(0, Math.floor(bonusScore));
          this.highestPieceValue = Math.max(0, Math.floor(highestPieceValue));
        };
        _proto.getBonusScore = function getBonusScore() {
          return this.bonusScore;
        };
        _proto.getHighestPieceValue = function getHighestPieceValue() {
          return this.highestPieceValue;
        }

        // 当前分数定义为棋盘内所有已落地棋子的数字总和，不包含仍在下落中的当前棋子。
        ;

        _proto.getBoardScore = function getBoardScore(board) {
          var score = 0;
          for (var _iterator = _createForOfIteratorHelperLoose(board), _step; !(_step = _iterator()).done;) {
            var row = _step.value;
            for (var _iterator2 = _createForOfIteratorHelperLoose(row), _step2; !(_step2 = _iterator2()).done;) {
              var piece = _step2.value;
              if (!piece) {
                continue;
              }
              score += piece.getValue();
            }
          }
          return score;
        };
        _proto.getTotalScore = function getTotalScore(board) {
          return this.getBoardScore(board) + this.bonusScore;
        }

        // 统一维护本局历史最高值，避免技能移除最高棋子后结算数字回落。
        ;

        _proto.updateHighestPieceValue = function updateHighestPieceValue(value) {
          this.highestPieceValue = Math.max(this.highestPieceValue, value);
        }

        /**
         * 构造一次合并奖励事件。
         *
         * 奖励分在动画开始前就可以结算，所以这里把结果值、吞并数量和连锁深度都记录下来，
         * 后续如果要接入日志、活动倍率或上报，也能复用同一份事件结构。
         *
         * @param nextValue 合并后锚点棋子的结果数字。
         * @param consumedCount 本次被吞并的棋子数量。
         * @param chainDepth 当前连锁深度。
         * @returns 可累计到奖励分里的合并奖励事件。
         */;
        _proto.buildMergeReward = function buildMergeReward(nextValue, consumedCount, chainDepth) {
          var amount = this.calculateMergeRewardAmount(nextValue, consumedCount, chainDepth);
          return {
            source: 'merge',
            amount: amount,
            resultValue: nextValue,
            consumedCount: consumedCount,
            chainDepth: chainDepth
          };
        }

        /**
         * 累计一组奖励分事件。
         *
         * 当前只累加奖励分数，返回值用于告诉调用方是否需要刷新 UI。
         * 之后如果增加日志、埋点或临时活动加成，也应集中在这里扩展。
         *
         * @param rewards 待累计的奖励事件列表。
         * @returns 是否发生了分数变化。
         */;
        _proto.applyScoreRewards = function applyScoreRewards(rewards) {
          if (rewards.length === 0) {
            return false;
          }
          for (var _iterator3 = _createForOfIteratorHelperLoose(rewards), _step3; !(_step3 = _iterator3()).done;) {
            var reward = _step3.value;
            this.bonusScore += reward.amount;
          }
          return true;
        }

        /**
         * 计算合并奖励分。
         *
         * 当前规则为“结果值 x 消除倍率”，消除棋子越多倍率越高。
         * 连锁深度参数先保留在公式入口中，方便后续活动或模式扩展时直接叠加。
         *
         * @param nextValue 合并后锚点棋子的结果数字。
         * @param consumedCount 本次被吞并的棋子数量。
         * @param chainDepth 当前连锁深度。
         * @returns 本次合并产生的奖励分。
         */;
        _proto.calculateMergeRewardAmount = function calculateMergeRewardAmount(nextValue, consumedCount, chainDepth) {
          var clearMultiplier = Math.max(1, consumedCount);
          // 连锁深度先单独保留入口，当前版本不叠加倍率，后续活动或模式扩展时直接在这里继续乘即可。
          var chainMultiplier = 1 + Math.max(0, chainDepth - 1) * 0;
          return Math.floor(nextValue * clearMultiplier * chainMultiplier);
        };
        return ScoreManager;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/SkillShopPopupController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './PlayerEconomyStore.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, _extends, cclegacy, _decorator, SpriteFrame, Tween, tween, Color, UITransform, UIOpacity, Graphics, Sprite, Vec3, Label, LabelOutline, Node, Component, ECONOMY_CONFIG;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
      _extends = module.extends;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      SpriteFrame = module.SpriteFrame;
      Tween = module.Tween;
      tween = module.tween;
      Color = module.Color;
      UITransform = module.UITransform;
      UIOpacity = module.UIOpacity;
      Graphics = module.Graphics;
      Sprite = module.Sprite;
      Vec3 = module.Vec3;
      Label = module.Label;
      LabelOutline = module.LabelOutline;
      Node = module.Node;
      Component = module.Component;
    }, function (module) {
      ECONOMY_CONFIG = module.ECONOMY_CONFIG;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10;
      cclegacy._RF.push({}, "338eb0hOI1LVq1nggKGgX+4", "SkillShopPopupController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      // 弹窗按设计稿使用固定视觉尺寸，再根据设备可用区域整体等比缩放。
      var PANEL_WIDTH = 650;
      var PANEL_HEIGHT = 680;
      var PANEL_EDGE_INSET = 32;
      var PANEL_VERTICAL_INSET = 72;
      var POPUP_ANIM_DURATION = 0.18;
      var SkillShopPopupController = exports('SkillShopPopupController', (_dec = ccclass('SkillShopPopupController'), _dec2 = property({
        type: SpriteFrame,
        tooltip: '购买技能弹窗底图'
      }), _dec3 = property({
        type: SpriteFrame,
        tooltip: '右上角关闭按钮图片'
      }), _dec4 = property({
        type: SpriteFrame,
        tooltip: '绿色购买按钮图片'
      }), _dec5 = property({
        type: SpriteFrame,
        tooltip: '蓝色开始游戏按钮图片'
      }), _dec6 = property({
        type: SpriteFrame,
        tooltip: '炸弹技能图片'
      }), _dec7 = property({
        type: SpriteFrame,
        tooltip: '锤子技能图片'
      }), _dec8 = property({
        type: SpriteFrame,
        tooltip: '交换技能图片'
      }), _dec9 = property({
        type: SpriteFrame,
        tooltip: '金币图片'
      }), _dec10 = property({
        type: SpriteFrame,
        tooltip: '技能数量底图，复用游戏内 AmountBG'
      }), _dec11 = property({
        type: [SpriteFrame],
        tooltip: '技能数量数字贴图，按 0-9 顺序配置'
      }), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(SkillShopPopupController, _Component);
        function SkillShopPopupController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          // 面板、按钮和技能图标全部引用项目现有素材，Prefab 可以在其它入口直接复用。
          _initializerDefineProperty(_this, "popupSpriteFrame", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "closeButtonSpriteFrame", _descriptor2, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "greenButtonSpriteFrame", _descriptor3, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "blueButtonSpriteFrame", _descriptor4, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "bombSpriteFrame", _descriptor5, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "hammerSpriteFrame", _descriptor6, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "swapSpriteFrame", _descriptor7, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "coinSpriteFrame", _descriptor8, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "amountBgSpriteFrame", _descriptor9, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "counterNumberSpriteFrames", _descriptor10, _assertThisInitialized(_this));
          _this.hostNode = null;
          _this.panelNode = null;
          _this.maskNode = null;
          _this.closeButtonNode = null;
          _this.startButtonNode = null;
          _this.messageLabel = null;
          _this.balanceLabel = null;
          _this.overlayOpacity = null;
          _this.purchaseHandler = null;
          _this.startHandler = null;
          _this.closeHandler = null;
          _this.purchaseButtonNodes = new Map();
          _this.purchaseButtonLabels = new Map();
          _this.skillCountSprites = new Map();
          _this.skillCountFallbackLabels = new Map();
          _this.currentSkillCounts = {
            bomb: 0,
            hammer: 0,
            swap: 0
          };
          _this.purchaseTapHandlers = new Map();
          _this.panelLayoutScale = 1;
          return _this;
        }
        var _proto = SkillShopPopupController.prototype;
        _proto.setup = function setup(options) {
          this.hostNode = options.hostNode;
          this.purchaseHandler = options.onPurchase;
          this.startHandler = options.onStart;
          this.closeHandler = options.onClose;
          this.ensureStructure();
          this.bindTouchEvents();
          this.syncLayout();
        }

        /**
         * 只接收经济层快照并刷新展示，金币扣除和技能库存变更仍由 HomeSceneController 负责。
         */;
        _proto.renderState = function renderState(snapshot) {
          if (this.balanceLabel) {
            this.balanceLabel.string = "" + snapshot.coins;
          }
          this.currentSkillCounts = _extends({}, snapshot.skills);
          this.refreshSkillRows(snapshot);
        };
        _proto.show = function show() {
          var _this$node$parent;
          if (!this.panelNode || !this.overlayOpacity) {
            return;
          }
          this.node.active = true;
          this.node.setSiblingIndex((_this$node$parent = this.node.parent) != null && _this$node$parent.children.length ? this.node.parent.children.length - 1 : 0);
          this.overlayOpacity.opacity = 0;
          this.panelNode.setScale(this.getPanelScale(0.92));
          Tween.stopAllByTarget(this.overlayOpacity);
          Tween.stopAllByTarget(this.panelNode);
          tween(this.overlayOpacity).to(0.14, {
            opacity: 255
          }).start();
          tween(this.panelNode).to(POPUP_ANIM_DURATION, {
            scale: this.getPanelScale()
          }, {
            easing: 'backOut'
          }).start();
        };
        _proto.hide = function hide(onHidden) {
          var _this2 = this;
          if (!this.panelNode || !this.overlayOpacity || !this.node.active) {
            onHidden == null || onHidden();
            return;
          }
          Tween.stopAllByTarget(this.overlayOpacity);
          Tween.stopAllByTarget(this.panelNode);
          tween(this.overlayOpacity).to(0.14, {
            opacity: 0
          }).call(function () {
            _this2.node.active = false;
            onHidden == null || onHidden();
          }).start();
          tween(this.panelNode).to(0.14, {
            scale: this.getPanelScale(0.96)
          }, {
            easing: 'quadIn'
          }).start();
        };
        _proto.showMessage = function showMessage(message, isError) {
          if (isError === void 0) {
            isError = false;
          }
          if (!this.messageLabel) {
            return;
          }
          this.messageLabel.string = message;
          this.messageLabel.color = isError ? new Color(202, 73, 63, 255) : new Color(43, 151, 92, 255);
        }

        // 首帧和屏幕尺寸变化时，遮罩铺满宿主节点，面板保持安全边距内居中。
        ;

        _proto.syncLayout = function syncLayout() {
          var _this$hostNode, _this$node$getCompone, _ref, _hostTransform$width, _ref2, _hostTransform$height, _this$panelNode, _this$panelNode2;
          var hostTransform = (_this$hostNode = this.hostNode) == null ? void 0 : _this$hostNode.getComponent(UITransform);
          var rootTransform = (_this$node$getCompone = this.node.getComponent(UITransform)) != null ? _this$node$getCompone : this.node.addComponent(UITransform);
          var width = (_ref = (_hostTransform$width = hostTransform == null ? void 0 : hostTransform.width) != null ? _hostTransform$width : rootTransform.width) != null ? _ref : 750;
          var height = (_ref2 = (_hostTransform$height = hostTransform == null ? void 0 : hostTransform.height) != null ? _hostTransform$height : rootTransform.height) != null ? _ref2 : 1334;
          rootTransform.setContentSize(width, height);
          this.drawMask(width, height);
          this.panelLayoutScale = Math.min(1, Math.max(0.56, (width - PANEL_EDGE_INSET * 2) / PANEL_WIDTH), Math.max(0.56, (height - PANEL_VERTICAL_INSET * 2) / PANEL_HEIGHT));
          (_this$panelNode = this.panelNode) == null || _this$panelNode.setPosition(0, 0, 0);
          (_this$panelNode2 = this.panelNode) == null || _this$panelNode2.setScale(this.getPanelScale());
        };
        _proto.onDestroy = function onDestroy() {
          var _this3 = this,
            _this$overlayOpacity;
          this.unbindTouchEvents();
          // 切场景时子节点可能已经被引擎先行销毁，只清理仍有效的缓存目标。
          this.stopNodeTween(this.node);
          this.stopNodeTween(this.panelNode);
          this.stopNodeTween(this.closeButtonNode);
          this.stopNodeTween(this.startButtonNode);
          this.purchaseButtonNodes.forEach(function (node) {
            return _this3.stopNodeTween(node);
          });
          if ((_this$overlayOpacity = this.overlayOpacity) != null && _this$overlayOpacity.isValid) {
            Tween.stopAllByTarget(this.overlayOpacity);
          }
          this.purchaseButtonNodes.clear();
          this.purchaseButtonLabels.clear();
          this.skillCountSprites.clear();
          this.skillCountFallbackLabels.clear();
          this.purchaseTapHandlers.clear();
        };
        _proto.ensureStructure = function ensureStructure() {
          var _this$node$getCompone2;
          this.overlayOpacity = (_this$node$getCompone2 = this.node.getComponent(UIOpacity)) != null ? _this$node$getCompone2 : this.node.addComponent(UIOpacity);
          this.maskNode = this.ensureMask();
          this.panelNode = this.ensurePanel();
          this.ensureHeader();
          this.ensureBalance();
          this.ensureSkillRows();
          this.ensureFooter();
          this.node.active = false;
        };
        _proto.ensureMask = function ensureMask() {
          var _mask$getComponent, _mask$getComponent2;
          var mask = this.getOrCreateNode(this.node, 'Mask');
          mask.setSiblingIndex(0);
          (_mask$getComponent = mask.getComponent(UITransform)) == null || _mask$getComponent.setContentSize(750, 1334);
          (_mask$getComponent2 = mask.getComponent(Graphics)) != null ? _mask$getComponent2 : mask.addComponent(Graphics);
          return mask;
        };
        _proto.ensurePanel = function ensurePanel() {
          var _panel$getComponent, _panel$getComponent2;
          var panel = this.getOrCreateNode(this.node, 'Panel');
          var sprite = (_panel$getComponent = panel.getComponent(Sprite)) != null ? _panel$getComponent : panel.addComponent(Sprite);
          sprite.spriteFrame = this.popupSpriteFrame;
          sprite.sizeMode = Sprite.SizeMode.CUSTOM;
          // SpriteFrame 赋值会先恢复素材原始尺寸，因此自定义尺寸必须放在最后设置。
          (_panel$getComponent2 = panel.getComponent(UITransform)) == null || _panel$getComponent2.setContentSize(PANEL_WIDTH, PANEL_HEIGHT);
          return panel;
        };
        _proto.ensureHeader = function ensureHeader() {
          if (!this.panelNode) {
            return;
          }
          this.ensureLabel(this.panelNode, 'Title', '购买技能', 48, new Vec3(0, 282, 0), 360, 68, new Color(255, 255, 255, 255), true);
          this.closeButtonNode = this.ensureSpriteNode(this.panelNode, 'CloseButton', this.closeButtonSpriteFrame, new Vec3(290, 286, 0), 68, 71);
        };
        _proto.ensureBalance = function ensureBalance() {
          var _balanceGroup$getComp;
          if (!this.panelNode) {
            return;
          }
          var balanceGroup = this.getOrCreateNode(this.panelNode, 'Balance');
          balanceGroup.setPosition(0, 218, 0);
          (_balanceGroup$getComp = balanceGroup.getComponent(UITransform)) == null || _balanceGroup$getComp.setContentSize(230, 48);
          this.ensureSpriteNode(balanceGroup, 'Coin', this.coinSpriteFrame, new Vec3(-58, 0, 0), 38, 40);
          this.balanceLabel = this.ensureLabel(balanceGroup, 'Amount', '0', 28, new Vec3(32, 0, 0), 140, 46, new Color(133, 67, 22, 255), true);
        };
        _proto.ensureSkillRows = function ensureSkillRows() {
          var _this4 = this;
          if (!this.panelNode) {
            return;
          }
          var rows = [{
            skill: 'bomb',
            name: '炸弹',
            price: 500,
            y: 126,
            icon: this.bombSpriteFrame
          }, {
            skill: 'hammer',
            name: '锤子',
            price: 300,
            y: -2,
            icon: this.hammerSpriteFrame
          }, {
            skill: 'swap',
            name: '交换',
            price: 400,
            y: -130,
            icon: this.swapSpriteFrame
          }];
          rows.forEach(function (row, index) {
            var _rowNode$getComponent, _buyButton$getChildBy, _buyButton$getChildBy2;
            var rowNode = _this4.getOrCreateNode(_this4.panelNode, "SkillRow_" + row.skill);
            rowNode.setPosition(0, row.y, 0);
            (_rowNode$getComponent = rowNode.getComponent(UITransform)) == null || _rowNode$getComponent.setContentSize(540, 118);
            _this4.ensureSpriteNode(rowNode, 'Icon', row.icon, new Vec3(-218, 0, 0), 104, 107);
            _this4.ensureSkillCountBadge(rowNode, row.skill);
            _this4.ensureLabel(rowNode, 'Name', row.name, 34, new Vec3(-58, 24, 0), 230, 52, new Color(112, 52, 14, 255), true);
            _this4.ensurePrice(rowNode, row.price);
            var buyButton = _this4.ensureImageButton(rowNode, 'BuyButton', _this4.greenButtonSpriteFrame, '购买', new Vec3(205, 0, 0), 150, 58, 30);
            _this4.purchaseButtonNodes.set(row.skill, buyButton);
            var buyLabel = (_buyButton$getChildBy = (_buyButton$getChildBy2 = buyButton.getChildByName('Label')) == null ? void 0 : _buyButton$getChildBy2.getComponent(Label)) != null ? _buyButton$getChildBy : null;
            if (buyLabel) {
              _this4.purchaseButtonLabels.set(row.skill, buyLabel);
            }
            if (index < rows.length - 1) {
              _this4.drawDivider(rowNode);
            }
          });
        };
        _proto.ensureSkillCountBadge = function ensureSkillCountBadge(rowNode, skill) {
          var _badge$getComponent, _countNode$getCompone;
          var badge = this.getOrCreateNode(rowNode, 'CountBadge');
          badge.setPosition(-179, -36, 0);
          (_badge$getComponent = badge.getComponent(UITransform)) == null || _badge$getComponent.setContentSize(36, 36);
          var amountBg = this.ensureSpriteNode(badge, 'AmountBG', this.amountBgSpriteFrame, Vec3.ZERO, 36, 36);
          amountBg.setSiblingIndex(0);
          var countNode = this.ensureSpriteNode(badge, 'Count', null, new Vec3(0, 0, 0), 14, 22);
          countNode.setSiblingIndex(1);
          var countSprite = (_countNode$getCompone = countNode.getComponent(Sprite)) != null ? _countNode$getCompone : countNode.addComponent(Sprite);
          this.skillCountSprites.set(skill, countSprite);
          var fallbackLabel = this.ensureLabel(badge, 'FallbackCount', '0', 19, Vec3.ZERO, 28, 28, new Color(255, 255, 255, 255), true);
          fallbackLabel.node.setSiblingIndex(2);
          this.skillCountFallbackLabels.set(skill, fallbackLabel);
        };
        _proto.refreshSkillRows = function refreshSkillRows(snapshot) {
          var skills = ['bomb', 'hammer', 'swap'];
          for (var _i = 0, _skills = skills; _i < _skills.length; _i++) {
            var _this$skillCountSprit, _this$skillCountFallb, _this$purchaseButtonN, _this$purchaseButtonL;
            var _skill = _skills[_i];
            var count = Math.min(ECONOMY_CONFIG.maxSkillCount, Math.max(0, Math.floor(snapshot.skills[_skill])));
            var numberSpriteFrame = this.getCounterNumberSpriteFrame(count);
            var countSprite = (_this$skillCountSprit = this.skillCountSprites.get(_skill)) != null ? _this$skillCountSprit : null;
            var fallbackLabel = (_this$skillCountFallb = this.skillCountFallbackLabels.get(_skill)) != null ? _this$skillCountFallb : null;
            if (countSprite) {
              countSprite.spriteFrame = numberSpriteFrame;
              countSprite.enabled = !!numberSpriteFrame;
            }
            if (fallbackLabel) {
              fallbackLabel.string = "" + count;
              fallbackLabel.node.active = !numberSpriteFrame;
            }
            var isMax = count >= ECONOMY_CONFIG.maxSkillCount;
            var button = (_this$purchaseButtonN = this.purchaseButtonNodes.get(_skill)) != null ? _this$purchaseButtonN : null;
            var buttonLabel = (_this$purchaseButtonL = this.purchaseButtonLabels.get(_skill)) != null ? _this$purchaseButtonL : null;
            if (buttonLabel) {
              buttonLabel.string = isMax ? '已满' : '购买';
            }
            if (button) {
              var _button$getComponent;
              var opacity = (_button$getComponent = button.getComponent(UIOpacity)) != null ? _button$getComponent : button.addComponent(UIOpacity);
              opacity.opacity = isMax ? 150 : 255;
            }
          }
        };
        _proto.getCounterNumberSpriteFrame = function getCounterNumberSpriteFrame(count) {
          var _ref3, _this$counterNumberSp;
          var displayCount = Math.min(ECONOMY_CONFIG.maxSkillCount, Math.max(0, count));
          var displayName = "" + displayCount;
          return (_ref3 = (_this$counterNumberSp = this.counterNumberSpriteFrames.find(function (spriteFrame) {
            return (spriteFrame == null ? void 0 : spriteFrame.name) === displayName;
          })) != null ? _this$counterNumberSp : this.counterNumberSpriteFrames[displayCount]) != null ? _ref3 : null;
        };
        _proto.ensurePrice = function ensurePrice(rowNode, price) {
          var _priceNode$getCompone, _priceNode$getCompone2;
          var priceNode = this.getOrCreateNode(rowNode, 'Price');
          priceNode.setPosition(-56, -27, 0);
          (_priceNode$getCompone = priceNode.getComponent(UITransform)) == null || _priceNode$getCompone.setContentSize(158, 46);
          var graphics = (_priceNode$getCompone2 = priceNode.getComponent(Graphics)) != null ? _priceNode$getCompone2 : priceNode.addComponent(Graphics);
          graphics.clear();
          graphics.fillColor = new Color(255, 218, 154, 230);
          graphics.roundRect(-79, -23, 158, 46, 23);
          graphics.fill();
          this.ensureSpriteNode(priceNode, 'Coin', this.coinSpriteFrame, new Vec3(-55, 0, 0), 36, 38);
          this.ensureLabel(priceNode, 'Amount', "" + price, 28, new Vec3(23, 0, 0), 100, 42, new Color(133, 67, 22, 255), true);
        };
        _proto.drawDivider = function drawDivider(rowNode) {
          var _divider$getComponent, _divider$getComponent2;
          var divider = this.getOrCreateNode(rowNode, 'Divider');
          divider.setPosition(5, -63, 0);
          (_divider$getComponent = divider.getComponent(UITransform)) == null || _divider$getComponent.setContentSize(470, 2);
          var graphics = (_divider$getComponent2 = divider.getComponent(Graphics)) != null ? _divider$getComponent2 : divider.addComponent(Graphics);
          graphics.clear();
          graphics.fillColor = new Color(239, 189, 125, 125);
          graphics.roundRect(-235, -1, 470, 2, 1);
          graphics.fill();
        };
        _proto.ensureFooter = function ensureFooter() {
          if (!this.panelNode) {
            return;
          }
          this.messageLabel = this.ensureLabel(this.panelNode, 'Message', '可在开始前补充技能', 22, new Vec3(0, -216, 0), 520, 38, new Color(153, 102, 64, 255), false);
          this.startButtonNode = this.ensureImageButton(this.panelNode, 'StartButton', this.blueButtonSpriteFrame, '开始游戏', new Vec3(0, -282, 0), 276, 106, 36);
        };
        _proto.ensureImageButton = function ensureImageButton(parent, name, spriteFrame, text, position, width, height, fontSize) {
          var button = this.ensureSpriteNode(parent, name, spriteFrame, position, width, height);
          this.ensureLabel(button, 'Label', text, fontSize, Vec3.ZERO, width - 20, height - 12, new Color(255, 255, 255, 255), true);
          return button;
        };
        _proto.ensureSpriteNode = function ensureSpriteNode(parent, name, spriteFrame, position, width, height) {
          var _node$getComponent, _node$getComponent2;
          var node = this.getOrCreateNode(parent, name);
          node.setPosition(position);
          var sprite = (_node$getComponent = node.getComponent(Sprite)) != null ? _node$getComponent : node.addComponent(Sprite);
          sprite.spriteFrame = spriteFrame;
          sprite.sizeMode = Sprite.SizeMode.CUSTOM;
          // 保持设计稿尺寸，不让 503px 按钮和 121px 金币图按原图大小撑开布局。
          (_node$getComponent2 = node.getComponent(UITransform)) == null || _node$getComponent2.setContentSize(width, height);
          return node;
        };
        _proto.ensureLabel = function ensureLabel(parent, name, text, fontSize, position, width, height, color, isBold) {
          var _node$getComponent3, _node$getComponent4, _node$getComponent5;
          var node = this.getOrCreateNode(parent, name);
          node.setPosition(position);
          var label = (_node$getComponent3 = node.getComponent(Label)) != null ? _node$getComponent3 : node.addComponent(Label);
          label.string = text;
          label.fontSize = fontSize;
          label.lineHeight = Math.ceil(fontSize * 1.15);
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
          label.color = color;
          label.isBold = isBold;
          var outline = (_node$getComponent4 = node.getComponent(LabelOutline)) != null ? _node$getComponent4 : node.addComponent(LabelOutline);
          outline.color = new Color(117, 42, 20, isBold ? 165 : 0);
          outline.width = isBold && color.r > 220 ? 2 : 0;
          // Label 组件初始化后可能写入默认尺寸，最后再恢复 Prefab 的布局宽高。
          (_node$getComponent5 = node.getComponent(UITransform)) == null || _node$getComponent5.setContentSize(width, height);
          return label;
        };
        _proto.getOrCreateNode = function getOrCreateNode(parent, name) {
          var node = parent.getChildByName(name);
          if (!node) {
            node = new Node(name);
            node.setParent(parent);
            node.addComponent(UITransform);
          }
          return node;
        };
        _proto.drawMask = function drawMask(width, height) {
          var _this$maskNode$getCom, _this$maskNode$getCom2;
          if (!this.maskNode) {
            return;
          }
          var transform = (_this$maskNode$getCom = this.maskNode.getComponent(UITransform)) != null ? _this$maskNode$getCom : this.maskNode.addComponent(UITransform);
          transform.setContentSize(width, height);
          var graphics = (_this$maskNode$getCom2 = this.maskNode.getComponent(Graphics)) != null ? _this$maskNode$getCom2 : this.maskNode.addComponent(Graphics);
          graphics.clear();
          graphics.fillColor = new Color(19, 42, 62, 142);
          graphics.rect(-width * 0.5, -height * 0.5, width, height);
          graphics.fill();
        };
        _proto.bindTouchEvents = function bindTouchEvents() {
          var _this5 = this;
          this.bindSwallowNode(this.maskNode);
          this.bindSwallowNode(this.panelNode);
          this.bindPressable(this.closeButtonNode, this.onCloseTap);
          this.bindPressable(this.startButtonNode, this.onStartTap);
          this.purchaseButtonNodes.forEach(function (node, skill) {
            var handler = _this5.purchaseTapHandlers.get(skill);
            if (!handler) {
              handler = function handler(event) {
                return _this5.onPurchaseTap(event, skill);
              };
              _this5.purchaseTapHandlers.set(skill, handler);
            }
            _this5.bindPressable(node, handler);
          });
        };
        _proto.unbindTouchEvents = function unbindTouchEvents() {
          var _this6 = this;
          this.unbindSwallowNode(this.maskNode);
          this.unbindSwallowNode(this.panelNode);
          this.unbindPressable(this.closeButtonNode, this.onCloseTap);
          this.unbindPressable(this.startButtonNode, this.onStartTap);
          this.purchaseButtonNodes.forEach(function (node, skill) {
            var handler = _this6.purchaseTapHandlers.get(skill);
            if (handler) {
              _this6.unbindPressable(node, handler);
            }
          });
        };
        _proto.bindSwallowNode = function bindSwallowNode(node) {
          if (!(node != null && node.isValid)) {
            return;
          }
          node.on(Node.EventType.TOUCH_START, this.consumeTouch, this);
          node.on(Node.EventType.TOUCH_MOVE, this.consumeTouch, this);
          node.on(Node.EventType.TOUCH_END, this.consumeTouch, this);
          node.on(Node.EventType.TOUCH_CANCEL, this.consumeTouch, this);
        };
        _proto.unbindSwallowNode = function unbindSwallowNode(node) {
          if (!(node != null && node.isValid)) {
            return;
          }
          node.off(Node.EventType.TOUCH_START, this.consumeTouch, this);
          node.off(Node.EventType.TOUCH_MOVE, this.consumeTouch, this);
          node.off(Node.EventType.TOUCH_END, this.consumeTouch, this);
          node.off(Node.EventType.TOUCH_CANCEL, this.consumeTouch, this);
        };
        _proto.bindPressable = function bindPressable(node, handler) {
          if (!(node != null && node.isValid)) {
            return;
          }
          node.on(Node.EventType.TOUCH_START, this.onButtonPressStart, this);
          node.on(Node.EventType.TOUCH_CANCEL, this.onButtonPressCancel, this);
          node.on(Node.EventType.TOUCH_END, handler, this);
        };
        _proto.unbindPressable = function unbindPressable(node, handler) {
          if (!(node != null && node.isValid)) {
            return;
          }
          node.off(Node.EventType.TOUCH_START, this.onButtonPressStart, this);
          node.off(Node.EventType.TOUCH_CANCEL, this.onButtonPressCancel, this);
          node.off(Node.EventType.TOUCH_END, handler, this);
        };
        _proto.onButtonPressStart = function onButtonPressStart(event) {
          event.propagationStopped = true;
          var target = event.currentTarget;
          Tween.stopAllByTarget(target);
          tween(target).to(0.06, {
            scale: new Vec3(0.94, 0.94, 1)
          }).start();
        };
        _proto.onButtonPressCancel = function onButtonPressCancel(event) {
          event.propagationStopped = true;
          this.restoreButtonScale(event.currentTarget);
        };
        _proto.onPurchaseTap = function onPurchaseTap(event, skill) {
          var _this$purchaseHandler;
          event.propagationStopped = true;
          this.restoreButtonScale(event.currentTarget);
          if (this.currentSkillCounts[skill] >= ECONOMY_CONFIG.maxSkillCount) {
            this.showMessage(this.getSkillName(skill) + "\u6700\u591A\u6301\u6709 " + ECONOMY_CONFIG.maxSkillCount + " \u4E2A", true);
            return;
          }
          (_this$purchaseHandler = this.purchaseHandler) == null || _this$purchaseHandler.call(this, skill);
        };
        _proto.getSkillName = function getSkillName(skill) {
          return skill === 'bomb' ? '炸弹' : skill === 'hammer' ? '锤子' : '交换';
        };
        _proto.onStartTap = function onStartTap(event) {
          var _this$startHandler;
          event.propagationStopped = true;
          this.restoreButtonScale(event.currentTarget);
          (_this$startHandler = this.startHandler) == null || _this$startHandler.call(this);
        };
        _proto.onCloseTap = function onCloseTap(event) {
          var _this$closeHandler;
          event.propagationStopped = true;
          this.restoreButtonScale(event.currentTarget);
          (_this$closeHandler = this.closeHandler) == null || _this$closeHandler.call(this);
        };
        _proto.restoreButtonScale = function restoreButtonScale(node) {
          Tween.stopAllByTarget(node);
          tween(node).to(0.08, {
            scale: Vec3.ONE
          }, {
            easing: 'quadOut'
          }).start();
        };
        _proto.consumeTouch = function consumeTouch(event) {
          event.propagationStopped = true;
        };
        _proto.getPanelScale = function getPanelScale(factor) {
          if (factor === void 0) {
            factor = 1;
          }
          var scale = this.panelLayoutScale * factor;
          return new Vec3(scale, scale, 1);
        };
        _proto.stopNodeTween = function stopNodeTween(node) {
          if (node != null && node.isValid) {
            Tween.stopAllByTarget(node);
          }
        };
        return SkillShopPopupController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "popupSpriteFrame", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "closeButtonSpriteFrame", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "greenButtonSpriteFrame", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "blueButtonSpriteFrame", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "bombSpriteFrame", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "hammerSpriteFrame", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "swapSpriteFrame", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "coinSpriteFrame", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "amountBgSpriteFrame", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "counterNumberSpriteFrames", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/SkillStock.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      cclegacy._RF.push({}, "51f10GNKPxMNJJNJNwfi87P", "SkillStock", undefined);
      // 技能库存只关心次数，不关心技能动画或棋盘结算，方便玩法控制器保持轻量。
      var SkillStock = exports('SkillStock', /*#__PURE__*/function () {
        function SkillStock(initialCount) {
          this.counts = void 0;
          this.initialCount = initialCount;
          this.counts = this.createInitialCounts();
        }

        // 每局开始时统一重置技能库存，保证炸弹、锤子、交换都从默认次数开始。
        var _proto = SkillStock.prototype;
        _proto.reset = function reset() {
          this.counts = this.createInitialCounts();
        }

        // 技能只有在真正施放成功后才扣次数，取消技能或无效目标不会消耗库存。
        ;

        _proto.consume = function consume(skill) {
          this.counts[skill] = Math.max(0, this.counts[skill] - 1);
        };
        _proto.has = function has(skill) {
          return this.counts[skill] > 0;
        }

        // 返回一份拷贝，避免 UI 或外部调用方误改库存内部状态。
        ;

        _proto.toUiState = function toUiState() {
          return {
            bomb: this.counts.bomb,
            hammer: this.counts.hammer,
            swap: this.counts.swap
          };
        };
        _proto.createInitialCounts = function createInitialCounts() {
          return {
            bomb: this.initialCount,
            hammer: this.initialCount,
            swap: this.initialCount
          };
        };
        return SkillStock;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/StartPageController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, _createForOfIteratorHelperLoose, cclegacy, _decorator, Color, Node, UITransform, UIOpacity, Vec3, Tween, tween, Label, Graphics, Sprite, instantiate, screen, Component;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Color = module.Color;
      Node = module.Node;
      UITransform = module.UITransform;
      UIOpacity = module.UIOpacity;
      Vec3 = module.Vec3;
      Tween = module.Tween;
      tween = module.tween;
      Label = module.Label;
      Graphics = module.Graphics;
      Sprite = module.Sprite;
      instantiate = module.instantiate;
      screen = module.screen;
      Component = module.Component;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12;
      cclegacy._RF.push({}, "8f27cT3UrNNN5M3Y4m0+69d", "StartPageController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;

      // 只读取首页胶囊避让所需字段，避免项目依赖额外的微信类型声明。

      // 首页整体改用低亮护眼色，降低手机屏幕上的白场刺激。
      var PAGE_BG_COLOR = new Color(235, 247, 244, 255);
      var PAGE_DOT_COLOR = new Color(164, 216, 219, 54);
      var MINT_COLOR = new Color(72, 202, 157, 255);
      var BLUE_COLOR = new Color(70, 161, 218, 255);
      var TEAL_COLOR = new Color(46, 108, 121, 255);
      var LIGHT_TEXT = new Color(255, 255, 255, 255);
      var SUBTEXT_COLOR = new Color(105, 153, 164, 255);
      var YELLOW_COLOR = new Color(246, 231, 153, 205);
      var GREEN_CIRCLE = new Color(176, 223, 150, 158);
      var START_BUTTON_WIDTH = 332;
      var START_BUTTON_HEIGHT = 90;
      var ACTION_ICON_WIDTH = 80;
      var ACTION_ICON_HEIGHT = 82;
      var ACTION_ICON_PAIR_OFFSET = 62;
      // 资源条保持已经确认的小尺寸，以下常量统一用于胶囊避让和标题间距计算。
      var AMOUNT_BAR_SCALE = 0.36;
      var AMOUNT_BAR_SOURCE_HEIGHT = 155;
      var AMOUNT_BAR_DEFAULT_TOP_INSET = 92;
      var AMOUNT_BAR_TITLE_GAP = 20;
      // 固定资源条左边缘，数值取自最初确认的 0.55 缩放布局，后续缩放不会再向中间漂移。
      var AMOUNT_BAR_LEFT_INSET = 57;
      // 首页排行榜需要轻雾化遮罩，暂停中复用排行榜时则保持透明，避免覆盖原有深色暂停蒙版。
      var RANK_MASK_HOME_COLOR = new Color(234, 246, 250, 212);
      var RANK_MASK_PAUSE_COLOR = new Color(0, 0, 0, 0);
      var RANKING_DATA = [{
        rank: 1,
        name: 'Mao',
        score: 42880,
        color: new Color(255, 209, 105, 255)
      }, {
        rank: 2,
        name: 'Lily',
        score: 29640,
        color: new Color(208, 240, 255, 255)
      }, {
        rank: 3,
        name: 'Kai',
        score: 24120,
        color: new Color(255, 225, 208, 255)
      }, {
        rank: 4,
        name: 'Mint',
        score: 18640,
        color: new Color(198, 242, 218, 255)
      }, {
        rank: 5,
        name: 'Berry',
        score: 15200,
        color: new Color(255, 215, 223, 255)
      }, {
        rank: 6,
        name: 'Ocean',
        score: 13440,
        color: new Color(212, 226, 255, 255)
      }];
      var TIP_TEXTS = ['相同数字相遇会合成更大的数字', '按住目标列，棋子会快速下落', '先观察底部数字，再选择落点', '连续合成可以快速拉高分数', '棋盘填满前，尽量留出一列空间'];
      var StartPageController = exports('StartPageController', (_dec = ccclass('StartPageController'), _dec2 = property({
        type: Node,
        tooltip: '首页根节点，建议在 home.scene 层级中维护'
      }), _dec3 = property({
        type: Node,
        tooltip: '首页内容容器，可选，默认查找 PageCard'
      }), _dec4 = property({
        type: Node,
        tooltip: '首页背景节点，可选，默认查找 Background'
      }), _dec5 = property({
        type: Node,
        tooltip: '首页背景图片节点，可选，默认查找 BackgroundImage'
      }), _dec6 = property({
        type: Node,
        tooltip: '开始游戏按钮节点，可选，默认查找 StartButton'
      }), _dec7 = property({
        type: Node,
        tooltip: '排行榜按钮节点，可选，默认查找 RankButton'
      }), _dec8 = property({
        type: Node,
        tooltip: '设置按钮节点，可选，默认查找 SettingsButton'
      }), _dec9 = property({
        type: Node,
        tooltip: '分享按钮节点，可选，默认查找 ShareButton'
      }), _dec10 = property({
        type: Node,
        tooltip: '排行榜遮罩节点，可选，默认查找 RankMask'
      }), _dec11 = property({
        type: Node,
        tooltip: '排行榜面板节点，可选，默认查找 RankPanel'
      }), _dec12 = property({
        type: Node,
        tooltip: '首页提示文本节点，可选，默认查找 TipText'
      }), _dec13 = property({
        type: Node,
        tooltip: 'Toast 节点，可选，默认查找 Toast'
      }), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(StartPageController, _Component);
        function StartPageController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          // 首页根节点优先由层级管理器指定，未指定时再按 StartPageOverlay 名称查找。
          _initializerDefineProperty(_this, "rootNodeRef", _descriptor, _assertThisInitialized(_this));
          // 首页内容容器优先从层级管理器读取，脚本只负责绑定事件和必要动画。
          _initializerDefineProperty(_this, "pageCardNodeRef", _descriptor2, _assertThisInitialized(_this));
          // 首页背景节点可在层级管理器里摆好，脚本只在绑定背景图时做 cover 适配。
          _initializerDefineProperty(_this, "backgroundNodeRef", _descriptor3, _assertThisInitialized(_this));
          // 首页背景图片节点可在层级管理器里拖入，未配置时保留代码兜底背景。
          _initializerDefineProperty(_this, "backgroundImageNodeRef", _descriptor4, _assertThisInitialized(_this));
          // 开始按钮建议在层级管理器里维护样式，脚本只绑定点击开始游戏。
          _initializerDefineProperty(_this, "startButtonNodeRef", _descriptor5, _assertThisInitialized(_this));
          // 底部排行榜入口建议使用层级管理器中的图片按钮。
          _initializerDefineProperty(_this, "rankButtonNodeRef", _descriptor6, _assertThisInitialized(_this));
          // 底部设置入口建议使用层级管理器中的图片按钮。
          _initializerDefineProperty(_this, "settingsButtonNodeRef", _descriptor7, _assertThisInitialized(_this));
          // 底部分享入口建议使用层级管理器中的图片按钮。
          _initializerDefineProperty(_this, "shareButtonNodeRef", _descriptor8, _assertThisInitialized(_this));
          // 排行榜遮罩和面板可由层级管理器搭好，脚本只负责显隐和数据兜底。
          _initializerDefineProperty(_this, "rankMaskNodeRef", _descriptor9, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "rankPanelNodeRef", _descriptor10, _assertThisInitialized(_this));
          // 首页提示文本和 Toast 都支持编辑器节点，避免运行时强行改层级。
          _initializerDefineProperty(_this, "tipTextNodeRef", _descriptor11, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "toastNodeRef", _descriptor12, _assertThisInitialized(_this));
          _this.startHandler = null;
          _this.shareHandler = null;
          _this.energyMoreHandler = null;
          _this.rootNode = null;
          _this.pageCardNode = null;
          _this.rankMaskNode = null;
          _this.rankPanelNode = null;
          _this.rankCloseButtonNode = null;
          _this.backgroundNode = null;
          _this.backgroundImageNode = null;
          _this.toastNode = null;
          _this.toastOpacity = null;
          _this.startButtonNode = null;
          _this.rankButtonNode = null;
          _this.settingsButtonNode = null;
          _this.shareButtonNode = null;
          // 首页只展示体力 Prefab；金币 Prefab 移到玩法场景，避免顶部信息重复。
          _this.energyBarNode = null;
          _this.energyMoreButtonNode = null;
          _this.energyHeartNodes = [];
          _this.tipLabel = null;
          _this.tipOpacity = null;
          _this.currentTipIndex = -1;
          _this.backgroundSpriteFrame = null;
          _this.rankButtonSpriteFrame = null;
          _this.settingsButtonSpriteFrame = null;
          _this.shareButtonSpriteFrame = null;
          // 暂停页打开排行榜时只借用榜单弹窗，不显示首页背景和首页卡片。
          _this.isRankOnlyMode = false;
          // 有层级节点时不再由脚本重新排版首页主体，避免覆盖编辑器里的 UI 调整。
          _this.usesHierarchyNodes = false;
          _this.pageDecorNodes = [];
          return _this;
        }
        var _proto = StartPageController.prototype;
        _proto.setup = function setup(options) {
          var _options$onShareTap, _options$backgroundSp, _options$rankButtonSp, _options$settingsButt, _options$shareButtonS, _options$onEnergyMore, _options$energyBarPre, _options$energy, _options$maxEnergy;
          this.startHandler = options.onStartTap;
          this.shareHandler = (_options$onShareTap = options.onShareTap) != null ? _options$onShareTap : null;
          this.backgroundSpriteFrame = (_options$backgroundSp = options.backgroundSpriteFrame) != null ? _options$backgroundSp : null;
          this.rankButtonSpriteFrame = (_options$rankButtonSp = options.rankButtonSpriteFrame) != null ? _options$rankButtonSp : null;
          this.settingsButtonSpriteFrame = (_options$settingsButt = options.settingsButtonSpriteFrame) != null ? _options$settingsButt : null;
          this.shareButtonSpriteFrame = (_options$shareButtonS = options.shareButtonSpriteFrame) != null ? _options$shareButtonS : null;
          this.energyMoreHandler = (_options$onEnergyMore = options.onEnergyMoreTap) != null ? _options$onEnergyMore : null;
          this.ensurePage();
          this.ensureEnergyBar((_options$energyBarPre = options.energyBarPrefab) != null ? _options$energyBarPre : null);
          this.renderPlayerResources((_options$energy = options.energy) != null ? _options$energy : 0, (_options$maxEnergy = options.maxEnergy) != null ? _options$maxEnergy : 4);
          this.syncLayout();
          this.show();
        };
        _proto.syncLayout = function syncLayout() {
          var _this$pageCardNode$ge, _this$pageCardNode;
          if (!this.rootNode) {
            return;
          }
          var parentTransform = this.node.getComponent(UITransform);
          var rootTransform = this.rootNode.getComponent(UITransform);
          var cardTransform = (_this$pageCardNode$ge = (_this$pageCardNode = this.pageCardNode) == null ? void 0 : _this$pageCardNode.getComponent(UITransform)) != null ? _this$pageCardNode$ge : null;
          if (!parentTransform || !rootTransform || !cardTransform || !this.pageCardNode) {
            return;
          }
          rootTransform.setContentSize(parentTransform.width, parentTransform.height);
          var cardWidth = parentTransform.width;
          var cardHeight = parentTransform.height;
          this.redrawBackground();
          if (!this.usesHierarchyNodes) {
            this.pageCardNode.setPosition(0, 0, 0);
            cardTransform.setContentSize(cardWidth, cardHeight);
            this.redrawCard();
            this.layoutPageContents(cardWidth, cardHeight);
          }
          this.layoutAmountBars(cardHeight);
          this.layoutRankModal(parentTransform.width, parentTransform.height);
        }

        // 首页逻辑层每次资源变化后只需要传入纯数值，Prefab 节点不持有经济状态。
        ;

        _proto.renderPlayerResources = function renderPlayerResources(energy, maxEnergy) {
          var visibleEnergy = Math.min(this.energyHeartNodes.length, Math.max(0, Math.floor(maxEnergy)), Math.max(0, Math.floor(energy)));
          this.energyHeartNodes.forEach(function (heartNode, index) {
            heartNode.active = index < visibleEnergy;
          });
        }

        // 首页逻辑层统一通过这个入口展示领取、分享和体力不足提示。
        ;

        _proto.showMessage = function showMessage(message) {
          this.showToast(message);
        };
        _proto.show = function show() {
          var _this$rootNode$getCom, _this$pageCardNode2;
          if (!this.rootNode) {
            return;
          }
          var opacity = (_this$rootNode$getCom = this.rootNode.getComponent(UIOpacity)) != null ? _this$rootNode$getCom : this.rootNode.addComponent(UIOpacity);
          this.rootNode.active = true;
          this.bringNodeToTop(this.rootNode);
          // 返回首页时要恢复上次隐藏动画压缩过的卡片比例，避免首页越显示越小。
          (_this$pageCardNode2 = this.pageCardNode) == null || _this$pageCardNode2.setScale(Vec3.ONE);
          opacity.opacity = 255;
        };
        _proto.hide = function hide(onHidden) {
          var _this$rootNode$getCom2,
            _this2 = this;
          if (!this.rootNode) {
            onHidden == null || onHidden();
            return;
          }
          var opacity = (_this$rootNode$getCom2 = this.rootNode.getComponent(UIOpacity)) != null ? _this$rootNode$getCom2 : this.rootNode.addComponent(UIOpacity);
          Tween.stopAllByTarget(opacity);
          if (this.pageCardNode) {
            Tween.stopAllByTarget(this.pageCardNode);
          }
          tween(opacity).to(0.16, {
            opacity: 0
          }).call(function () {
            if (_this2.rootNode) {
              _this2.rootNode.active = false;
            }
            onHidden == null || onHidden();
          }).start();
          if (this.pageCardNode) {
            tween(this.pageCardNode).to(0.16, {
              scale: new Vec3(0.97, 0.97, 1)
            }).start();
          }
        }

        // 外部页面可以复用首页排行榜弹窗；rankOnly 为 true 时只显示榜单，不恢复首页主体。
        ;

        _proto.showRankModal = function showRankModal(rankOnly, event) {
          var _this$rankMaskNode$ge;
          if (rankOnly === void 0) {
            rankOnly = false;
          }
          if (event) {
            event.propagationStopped = true;
          }
          if (!this.rankMaskNode || !this.rankPanelNode) {
            return;
          }
          this.isRankOnlyMode = rankOnly;
          if (rankOnly && this.rootNode) {
            var _this$rootNode$getCom3;
            this.rootNode.active = true;
            this.bringNodeToTop(this.rootNode);
            var rootOpacity = (_this$rootNode$getCom3 = this.rootNode.getComponent(UIOpacity)) != null ? _this$rootNode$getCom3 : this.rootNode.addComponent(UIOpacity);
            rootOpacity.opacity = 255;
            var background = this.backgroundNode;
            if (background) {
              background.active = false;
            }
            if (this.pageCardNode) {
              this.pageCardNode.active = false;
            }
          }
          this.refreshRankMaskStyle();
          var opacity = (_this$rankMaskNode$ge = this.rankMaskNode.getComponent(UIOpacity)) != null ? _this$rankMaskNode$ge : this.rankMaskNode.addComponent(UIOpacity);
          opacity.opacity = 0;
          this.rankMaskNode.active = true;
          this.rankPanelNode.setScale(new Vec3(0.94, 0.94, 1));
          tween(opacity).to(0.14, {
            opacity: 255
          }).start();
          tween(this.rankPanelNode).to(0.18, {
            scale: Vec3.ONE
          }, {
            easing: 'backOut'
          }).start();
        };
        _proto.onDestroy = function onDestroy() {
          this.unscheduleAllCallbacks();
          this.unbindPressableButton(this.startButtonNode, this.handleStartTap);
          this.unbindPressableButton(this.rankButtonNode, this.handleRankTap);
          this.unbindPressableButton(this.shareButtonNode, this.handleShareTap);
          this.unbindAmountBar(this.energyMoreButtonNode, this.handleEnergyMoreTap);
          this.safeOff(this.rankCloseButtonNode, Node.EventType.TOUCH_END, this.handleRankCloseTap);
          this.safeOff(this.rankMaskNode, Node.EventType.TOUCH_END, this.hideRankModal);
          this.safeOff(this.toastNode, Node.EventType.TOUCH_END, this.consumeTouch);
          this.stopPageTweens();
          if (this.tipOpacity) {
            Tween.stopAllByTarget(this.tipOpacity);
          }
        };
        _proto.ensurePage = function ensurePage() {
          if (this.rootNode) {
            return;
          }
          var hierarchyRoot = this.resolveHierarchyRoot();
          if (hierarchyRoot) {
            this.bindHierarchyPage(hierarchyRoot);
            this.ensureHierarchyFallbackNodes();
            this.ensureHierarchyDynamicEffects();
            this.bindPageInteractions();
            this.startTipRotation();
            return;
          }
          this.buildRuntimeFallbackPage();
          this.bindPageInteractions();
          this.startTipRotation();
        }

        // 首页场景优先使用层级管理器中的节点，便于后续直接在 Creator 里调整 UI 样式。
        ;

        _proto.resolveHierarchyRoot = function resolveHierarchyRoot() {
          if (this.rootNodeRef) {
            return this.rootNodeRef;
          }
          if (this.node.name === 'StartPageOverlay') {
            return this.node;
          }
          return this.node.getChildByName('StartPageOverlay');
        }

        // 绑定已有首页节点时只缓存引用，不主动重建视觉层级。
        ;

        _proto.bindHierarchyPage = function bindHierarchyPage(root) {
          var _this$rootNode$getCom4,
            _this$rootNode$getCom5,
            _this$backgroundNodeR,
            _this$backgroundImage,
            _this$pageCardNodeRef,
            _this$startButtonNode,
            _this$rankButtonNodeR,
            _this$settingsButtonN,
            _this$shareButtonNode,
            _this$rankMaskNodeRef,
            _this$rankPanelNodeRe,
            _this$toastNodeRef,
            _this$tipTextNodeRef,
            _ref,
            _tipNode$getComponent,
            _tipNode$getChildByNa,
            _ref2,
            _tipNode$getComponent2,
            _ref3,
            _this$toastNode$getCo,
            _this$toastNode,
            _this$toastNode2,
            _this3 = this;
          this.usesHierarchyNodes = true;
          this.rootNode = root;
          (_this$rootNode$getCom4 = this.rootNode.getComponent(UITransform)) != null ? _this$rootNode$getCom4 : this.rootNode.addComponent(UITransform);
          (_this$rootNode$getCom5 = this.rootNode.getComponent(UIOpacity)) != null ? _this$rootNode$getCom5 : this.rootNode.addComponent(UIOpacity);
          this.backgroundNode = (_this$backgroundNodeR = this.backgroundNodeRef) != null ? _this$backgroundNodeR : this.findChildDeep(root, 'Background');
          this.backgroundImageNode = (_this$backgroundImage = this.backgroundImageNodeRef) != null ? _this$backgroundImage : this.findChildDeep(root, 'BackgroundImage');
          this.pageCardNode = (_this$pageCardNodeRef = this.pageCardNodeRef) != null ? _this$pageCardNodeRef : this.findChildDeep(root, 'PageCard');
          this.startButtonNode = (_this$startButtonNode = this.startButtonNodeRef) != null ? _this$startButtonNode : this.findChildDeep(root, 'StartButton');
          this.rankButtonNode = (_this$rankButtonNodeR = this.rankButtonNodeRef) != null ? _this$rankButtonNodeR : this.findChildDeep(root, 'RankButton');
          this.settingsButtonNode = (_this$settingsButtonN = this.settingsButtonNodeRef) != null ? _this$settingsButtonN : this.findChildDeep(root, 'SettingsButton');
          this.shareButtonNode = (_this$shareButtonNode = this.shareButtonNodeRef) != null ? _this$shareButtonNode : this.findChildDeep(root, 'ShareButton');
          this.hideHomeSettingsButton();
          this.rankMaskNode = (_this$rankMaskNodeRef = this.rankMaskNodeRef) != null ? _this$rankMaskNodeRef : this.findChildDeep(root, 'RankMask');
          this.rankPanelNode = (_this$rankPanelNodeRe = this.rankPanelNodeRef) != null ? _this$rankPanelNodeRe : this.rankMaskNode ? this.findChildDeep(this.rankMaskNode, 'RankPanel') : this.findChildDeep(root, 'RankPanel');
          this.rankCloseButtonNode = this.rankPanelNode ? this.findChildDeep(this.rankPanelNode, 'CloseButton') : this.findChildDeep(root, 'CloseButton');
          this.toastNode = (_this$toastNodeRef = this.toastNodeRef) != null ? _this$toastNodeRef : this.findChildDeep(root, 'Toast');
          var tipNode = (_this$tipTextNodeRef = this.tipTextNodeRef) != null ? _this$tipTextNodeRef : this.findChildDeep(root, 'TipText');
          this.tipLabel = (_ref = (_tipNode$getComponent = tipNode == null ? void 0 : tipNode.getComponent(Label)) != null ? _tipNode$getComponent : tipNode == null || (_tipNode$getChildByNa = tipNode.getChildByName('Label')) == null ? void 0 : _tipNode$getChildByNa.getComponent(Label)) != null ? _ref : null;
          this.tipOpacity = (_ref2 = (_tipNode$getComponent2 = tipNode == null ? void 0 : tipNode.getComponent(UIOpacity)) != null ? _tipNode$getComponent2 : tipNode == null ? void 0 : tipNode.addComponent(UIOpacity)) != null ? _ref2 : null;
          if (this.tipLabel && !this.tipLabel.string) {
            this.tipLabel.string = this.pickNextTip();
          }
          this.toastOpacity = (_ref3 = (_this$toastNode$getCo = (_this$toastNode = this.toastNode) == null ? void 0 : _this$toastNode.getComponent(UIOpacity)) != null ? _this$toastNode$getCo : (_this$toastNode2 = this.toastNode) == null ? void 0 : _this$toastNode2.addComponent(UIOpacity)) != null ? _ref3 : null;
          this.pageDecorNodes = ['DecorLeft', 'DecorRight'].map(function (name) {
            return _this3.findChildDeep(root, name);
          }).filter(function (node) {
            return !!node;
          });
        }

        // 层级节点不完整时只补功能必需节点，避免因为少拖一个节点导致首页无法进入游戏。
        ;

        _proto.ensureHierarchyFallbackNodes = function ensureHierarchyFallbackNodes() {
          if (!this.rootNode) {
            return;
          }
          if (!this.backgroundNode) {
            this.backgroundNode = new Node('Background');
            this.backgroundNode.setParent(this.rootNode);
            this.backgroundNode.addComponent(UITransform);
            this.backgroundNode.addComponent(Graphics);
          }
          if (!this.backgroundImageNode && this.backgroundNode) {
            this.backgroundImageNode = new Node('BackgroundImage');
            this.backgroundImageNode.setParent(this.backgroundNode);
            this.backgroundImageNode.addComponent(UITransform);
            this.backgroundImageNode.addComponent(Sprite);
          }
          if (!this.pageCardNode) {
            this.pageCardNode = new Node('PageCard');
            this.pageCardNode.setParent(this.rootNode);
            this.pageCardNode.addComponent(UITransform);
            this.pageCardNode.addComponent(Graphics);
          }
          if (!this.startButtonNode && this.pageCardNode) {
            this.startButtonNode = this.createStartButton(this.pageCardNode);
          }
          if (!this.rankButtonNode || !this.shareButtonNode) {
            this.ensureFallbackActionButtons();
          }
          if (!this.rankMaskNode) {
            this.buildRankModal(this.rootNode);
          }
          if (!this.toastNode) {
            this.buildToast(this.rootNode);
          }
          if (!this.tipLabel && this.pageCardNode) {
            this.buildTipText(this.pageCardNode);
          }
        }

        // 首页静态视觉由 home.scene 层级维护，这里只补充需要运行时 tween 的动效节点。
        ;

        _proto.ensureHierarchyDynamicEffects = function ensureHierarchyDynamicEffects() {
          var _this$pageCardNode$ge2;
          if (!this.usesHierarchyNodes || !this.pageCardNode) {
            return;
          }
          this.ensureHierarchyOldLogo();
          this.ensureHierarchyOldStartButton();
          if (!this.pageCardNode.getChildByName('TileRow')) {
            this.buildFloatingTiles(this.pageCardNode);
          }
          (_this$pageCardNode$ge2 = this.pageCardNode.getChildByName('TileRow')) == null || _this$pageCardNode$ge2.setPosition(0, 0, 0);
          this.startHierarchyStartButtonBreathing();
        }

        /**
         * 把体力 Prefab 挂到首页 PageCard 顶部。
         *
         * Prefab 负责内部美术结构，首页控制器只负责整体布局、数值刷新和按钮回调；
         * 重复 setup 时优先复用已有节点，避免热重载产生重复资源条。
         */;
        _proto.ensureEnergyBar = function ensureEnergyBar(energyBarPrefab) {
          var _this4 = this;
          if (!this.pageCardNode) {
            return;
          }
          this.energyBarNode = this.pageCardNode.getChildByName('EnergyBar');
          if (!this.energyBarNode && energyBarPrefab) {
            this.energyBarNode = instantiate(energyBarPrefab);
            this.energyBarNode.setParent(this.pageCardNode);
          }
          this.energyHeartNodes = this.energyBarNode ? [1, 2, 3, 4].map(function (index) {
            var _this4$energyBarNode$, _this4$energyBarNode;
            return (_this4$energyBarNode$ = (_this4$energyBarNode = _this4.energyBarNode) == null ? void 0 : _this4$energyBarNode.getChildByName("Heart" + index)) != null ? _this4$energyBarNode$ : null;
          }).filter(function (node) {
            return !!node;
          }) : [];
          // 整个体力 Prefab 都是分享入口，加号只是视觉提示。
          this.energyMoreButtonNode = this.energyBarNode;
          this.unbindAmountBar(this.energyMoreButtonNode, this.handleEnergyMoreTap);
          this.bindAmountBar(this.energyMoreButtonNode, this.handleEnergyMoreTap);
        }

        /**
         * 布局首页体力条并与微信原生胶囊水平对齐。
         *
         * Web 和编辑器沿用设计稿顶部间距；微信端把胶囊中心换算到 Cocos 画布，
         * 体力条放在左侧并共享同一条水平中线，不与右侧原生胶囊重叠。
         */;
        _proto.layoutAmountBars = function layoutAmountBars(cardHeight) {
          var _this$pageCardNode$ge3, _this$pageCardNode3, _this$energyBarNode$g, _this$energyBarNode;
          var menuMetrics = this.getWechatMenuMetrics();
          var amountBarHalfHeight = AMOUNT_BAR_SOURCE_HEIGHT * AMOUNT_BAR_SCALE * 0.5;
          var centerTopInset = AMOUNT_BAR_DEFAULT_TOP_INSET;
          if (menuMetrics) {
            var sourceWindowHeight = menuMetrics.windowHeight > 0 ? menuMetrics.windowHeight : screen.windowSize.height;
            var heightScale = cardHeight / Math.max(1, sourceWindowHeight);
            var capsuleCenterFromTop = Math.max(0, (menuMetrics.menuRect.top + menuMetrics.menuRect.bottom) * 0.5 - menuMetrics.screenTop) * heightScale;
            centerTopInset = Math.min(cardHeight - amountBarHalfHeight, Math.max(amountBarHalfHeight, capsuleCenterFromTop));
          }
          var y = cardHeight / 2 - centerTopInset;
          var cardWidth = (_this$pageCardNode$ge3 = (_this$pageCardNode3 = this.pageCardNode) == null || (_this$pageCardNode3 = _this$pageCardNode3.getComponent(UITransform)) == null ? void 0 : _this$pageCardNode3.width) != null ? _this$pageCardNode$ge3 : 750;
          var amountBarWidth = (_this$energyBarNode$g = (_this$energyBarNode = this.energyBarNode) == null || (_this$energyBarNode = _this$energyBarNode.getComponent(UITransform)) == null ? void 0 : _this$energyBarNode.width) != null ? _this$energyBarNode$g : 466;
          var x = -cardWidth * 0.5 + AMOUNT_BAR_LEFT_INSET + amountBarWidth * AMOUNT_BAR_SCALE * 0.5;
          this.configureAmountBarNode(this.energyBarNode, x, y);
          this.layoutTitleBelowAmountBars(cardHeight, y, amountBarHalfHeight, !!menuMetrics);
        };
        _proto.configureAmountBarNode = function configureAmountBarNode(amountBarNode, x, y) {
          if (!amountBarNode) {
            return;
          }
          amountBarNode.setPosition(x, y, 0);
          amountBarNode.setScale(AMOUNT_BAR_SCALE, AMOUNT_BAR_SCALE, 1);
        }

        // 微信端资源条下移后给标题腾出固定间距；非微信平台恢复首页原始标题位置。
        ;

        _proto.layoutTitleBelowAmountBars = function layoutTitleBelowAmountBars(cardHeight, amountBarY, amountBarHalfHeight, shouldAvoidCapsule) {
          var _this$pageCardNode$ge4, _this$pageCardNode4, _titleCard$getCompone;
          var titleCard = (_this$pageCardNode$ge4 = (_this$pageCardNode4 = this.pageCardNode) == null ? void 0 : _this$pageCardNode4.getChildByName('TitleCard')) != null ? _this$pageCardNode$ge4 : null;
          var titleTransform = (_titleCard$getCompone = titleCard == null ? void 0 : titleCard.getComponent(UITransform)) != null ? _titleCard$getCompone : null;
          if (!titleCard || !titleTransform) {
            return;
          }
          var defaultTitleY = cardHeight * 0.31;
          var titleY = shouldAvoidCapsule ? Math.min(defaultTitleY, amountBarY - amountBarHalfHeight - AMOUNT_BAR_TITLE_GAP - titleTransform.height * 0.5) : defaultTitleY;
          titleCard.setPosition(titleCard.position.x, titleY, titleCard.position.z);
        }

        // 微信小游戏的胶囊坐标需结合窗口高度和 screenTop，才能正确换算到 Creator 画布。
        ;

        _proto.getWechatMenuMetrics = function getWechatMenuMetrics() {
          var _windowInfo$windowHei, _windowInfo$screenTop;
          var wxApi = globalThis.wx;
          if (!wxApi || typeof wxApi.getMenuButtonBoundingClientRect !== 'function') {
            return null;
          }
          var menuRect = wxApi.getMenuButtonBoundingClientRect();
          if (!menuRect || menuRect.width <= 0 || menuRect.height <= 0) {
            return null;
          }
          var windowInfo = typeof wxApi.getWindowInfo === 'function' ? wxApi.getWindowInfo() : typeof wxApi.getSystemInfoSync === 'function' ? wxApi.getSystemInfoSync() : null;
          return {
            menuRect: menuRect,
            windowHeight: (_windowInfo$windowHei = windowInfo == null ? void 0 : windowInfo.windowHeight) != null ? _windowInfo$windowHei : 0,
            screenTop: (_windowInfo$screenTop = windowInfo == null ? void 0 : windowInfo.screenTop) != null ? _windowInfo$screenTop : 0
          };
        }

        // 首页旧版 logo 是代码绘制的数字块标题；层级里的图片 logo 只留给加载页使用。
        ;

        _proto.ensureHierarchyOldLogo = function ensureHierarchyOldLogo() {
          var _this$pageCardNode$ge5;
          if (!this.pageCardNode) {
            return;
          }
          var imageLogoNode = this.pageCardNode.getChildByName('Logo');
          if (imageLogoNode) {
            imageLogoNode.active = false;
          }
          if (!this.pageCardNode.getChildByName('TitleCard')) {
            this.buildTitleCard(this.pageCardNode);
          }
          (_this$pageCardNode$ge5 = this.pageCardNode.getChildByName('TitleCard')) == null || _this$pageCardNode$ge5.setPosition(0, 414, 0);
        }

        // 旧版开始按钮由 Graphics 绘制，不依赖图片资源，方便保持原来的胶囊按钮观感。
        ;

        _proto.ensureHierarchyOldStartButton = function ensureHierarchyOldStartButton() {
          var _this$startButtonNode2, _this$startButtonNode3;
          if (!this.startButtonNode) {
            return;
          }
          var transform = (_this$startButtonNode2 = this.startButtonNode.getComponent(UITransform)) != null ? _this$startButtonNode2 : this.startButtonNode.addComponent(UITransform);
          transform.setContentSize(START_BUTTON_WIDTH, START_BUTTON_HEIGHT);
          this.startButtonNode.setPosition(0, -214, 0);
          var sprite = this.startButtonNode.getComponent(Sprite);
          if (sprite) {
            sprite.enabled = false;
          }
          var graphics = (_this$startButtonNode3 = this.startButtonNode.getComponent(Graphics)) != null ? _this$startButtonNode3 : this.startButtonNode.addComponent(Graphics);
          graphics.clear();
          graphics.fillColor = new Color(105, 54, 90, 72);
          graphics.roundRect(-START_BUTTON_WIDTH / 2 + 2, -START_BUTTON_HEIGHT / 2 - 8, START_BUTTON_WIDTH - 4, START_BUTTON_HEIGHT, START_BUTTON_HEIGHT / 2);
          graphics.fill();
          graphics.fillColor = new Color(255, 70, 115, 255);
          graphics.roundRect(-START_BUTTON_WIDTH / 2, -START_BUTTON_HEIGHT / 2, START_BUTTON_WIDTH, START_BUTTON_HEIGHT, START_BUTTON_HEIGHT / 2);
          graphics.fill();
          graphics.fillColor = new Color(255, 103, 144, 255);
          graphics.roundRect(-START_BUTTON_WIDTH / 2 + 18, 9, START_BUTTON_WIDTH - 36, 20, 10);
          graphics.fill();
          var shadow = this.ensureButtonTextLabel(this.startButtonNode, 'LabelShadow', '开始游戏', 38, new Color(128, 31, 58, 116), new Vec3(0, -4, 0));
          shadow.isBold = true;
          var label = this.ensureButtonTextLabel(this.startButtonNode, 'Label', '开始游戏', 38, LIGHT_TEXT, new Vec3(0, 1, 0));
          label.isBold = true;
        };
        _proto.ensureButtonTextLabel = function ensureButtonTextLabel(parent, name, text, fontSize, color, position) {
          var _node$getComponent, _node$getComponent2;
          var node = parent.getChildByName(name);
          if (!node) {
            node = new Node(name);
            node.setParent(parent);
          }
          node.setPosition(position);
          var transform = (_node$getComponent = node.getComponent(UITransform)) != null ? _node$getComponent : node.addComponent(UITransform);
          transform.setContentSize(START_BUTTON_WIDTH, 58);
          var label = (_node$getComponent2 = node.getComponent(Label)) != null ? _node$getComponent2 : node.addComponent(Label);
          label.string = text;
          label.fontSize = fontSize;
          label.lineHeight = fontSize + 6;
          label.color = color;
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
          return label;
        }

        // 层级中已经摆好的开始按钮只追加呼吸动效，不再由脚本重建按钮节点。
        ;

        _proto.startHierarchyStartButtonBreathing = function startHierarchyStartButtonBreathing() {
          if (!this.startButtonNode) {
            return;
          }
          Tween.stopAllByTarget(this.startButtonNode);
          tween(this.startButtonNode).repeatForever(tween().sequence(tween().to(1.15, {
            scale: new Vec3(1.025, 1.025, 1)
          }, {
            easing: 'sineInOut'
          }), tween().to(1.15, {
            scale: Vec3.ONE
          }, {
            easing: 'sineInOut'
          }))).start();
        }

        // 旧场景没有首页节点时保留运行时兜底，方便 Web 预览和资源缺失排查。
        ;

        _proto.buildRuntimeFallbackPage = function buildRuntimeFallbackPage() {
          var root = new Node('StartPageOverlay');
          root.setParent(this.node);
          root.addComponent(UITransform);
          root.addComponent(UIOpacity);
          this.rootNode = root;
          var background = new Node('Background');
          background.setParent(root);
          background.addComponent(UITransform);
          background.addComponent(Graphics);
          this.backgroundNode = background;

          // 首页背景图独立放在子节点上，父节点保留 Graphics 兜底，资源丢失时仍能绘制旧背景。
          var backgroundImage = new Node('BackgroundImage');
          backgroundImage.setParent(background);
          backgroundImage.addComponent(UITransform);
          backgroundImage.addComponent(Sprite);
          this.backgroundImageNode = backgroundImage;
          var card = new Node('PageCard');
          card.setParent(root);
          card.addComponent(UITransform);
          card.addComponent(Graphics);
          this.pageCardNode = card;
          var decorTopLeft = this.createCircleDecoration(card, 'DecorLeft', 78, GREEN_CIRCLE, 0.88);
          var decorTopRight = this.createCircleDecoration(card, 'DecorRight', 92, YELLOW_COLOR, 0.92);
          this.pageDecorNodes.push(decorTopLeft, decorTopRight);
          this.buildTitleCard(card);
          this.buildFloatingTiles(card);
          this.startButtonNode = this.createStartButton(card);
          this.buildActionButtons(card);
          this.buildTipText(card);
          this.buildRankModal(root);
          this.buildToast(root);
        }

        // 统一绑定首页交互，兼容编辑器节点和运行时兜底节点两种来源。
        ;

        _proto.bindPageInteractions = function bindPageInteractions() {
          if (this.rootNode) {
            this.bindSwallowTouch(this.rootNode);
          }
          if (this.pageCardNode && this.pageCardNode !== this.rootNode) {
            this.bindSwallowTouch(this.pageCardNode);
          }
          if (this.rankPanelNode) {
            this.bindSwallowTouch(this.rankPanelNode);
          }
          if (this.toastNode) {
            this.safeOff(this.toastNode, Node.EventType.TOUCH_END, this.consumeTouch);
            this.safeOn(this.toastNode, Node.EventType.TOUCH_END, this.consumeTouch);
          }
          this.unbindPressableButton(this.startButtonNode, this.handleStartTap);
          this.unbindPressableButton(this.rankButtonNode, this.handleRankTap);
          this.unbindPressableButton(this.shareButtonNode, this.handleShareTap);
          this.bindPressableButton(this.startButtonNode, this.handleStartTap);
          this.bindPressableButton(this.rankButtonNode, this.handleRankTap);
          this.bindPressableButton(this.shareButtonNode, this.handleShareTap);
          this.safeOff(this.rankCloseButtonNode, Node.EventType.TOUCH_END, this.handleRankCloseTap);
          this.safeOn(this.rankCloseButtonNode, Node.EventType.TOUCH_END, this.handleRankCloseTap);
          this.safeOff(this.rankMaskNode, Node.EventType.TOUCH_END, this.hideRankModal);
          this.safeOn(this.rankMaskNode, Node.EventType.TOUCH_END, this.hideRankModal);
        }

        // 层级里只缺少部分底部按钮时，在已有 ActionBar 下补齐，不覆盖已经摆好的按钮。
        ;

        _proto.ensureFallbackActionButtons = function ensureFallbackActionButtons() {
          if (!this.pageCardNode) {
            return;
          }
          var bar = this.pageCardNode.getChildByName('ActionBar');
          if (!bar) {
            bar = new Node('ActionBar');
            bar.setParent(this.pageCardNode);
            bar.addComponent(UITransform).setContentSize(300, 96);
          }
          if (!this.rankButtonNode) {
            this.rankButtonNode = this.createActionIconButton(bar, 'RankButton', this.rankButtonSpriteFrame, '榜');
            this.rankButtonNode.setPosition(-ACTION_ICON_PAIR_OFFSET, 0, 0);
          }
          if (!this.shareButtonNode) {
            this.shareButtonNode = this.createActionIconButton(bar, 'ShareButton', this.shareButtonSpriteFrame, '享');
            this.shareButtonNode.setPosition(ACTION_ICON_PAIR_OFFSET, 0, 0);
          }
          this.hideHomeSettingsButton();
        };
        _proto.hideHomeSettingsButton = function hideHomeSettingsButton() {
          if (!this.settingsButtonNode) {
            return;
          }

          // 首页不再提供设置入口；保留节点引用仅用于兼容旧场景，避免运行时残留可点击热区。
          this.settingsButtonNode.active = false;
        };
        _proto.redrawBackground = function redrawBackground() {
          var _this$backgroundNode, _this$rootNode, _background$getCompon, _background$getCompon2, _ref4, _this$backgroundImage2, _backgroundImage$getC, _backgroundImage$getC2, _this$rootNode$getCom6, _this$rootNode2;
          var background = (_this$backgroundNode = this.backgroundNode) != null ? _this$backgroundNode : (_this$rootNode = this.rootNode) == null ? void 0 : _this$rootNode.getChildByName('Background');
          var backgroundTransform = (_background$getCompon = background == null ? void 0 : background.getComponent(UITransform)) != null ? _background$getCompon : null;
          var graphics = (_background$getCompon2 = background == null ? void 0 : background.getComponent(Graphics)) != null ? _background$getCompon2 : null;
          var backgroundImage = (_ref4 = (_this$backgroundImage2 = this.backgroundImageNode) != null ? _this$backgroundImage2 : background == null ? void 0 : background.getChildByName('BackgroundImage')) != null ? _ref4 : null;
          var backgroundImageTransform = (_backgroundImage$getC = backgroundImage == null ? void 0 : backgroundImage.getComponent(UITransform)) != null ? _backgroundImage$getC : null;
          var backgroundImageSprite = (_backgroundImage$getC2 = backgroundImage == null ? void 0 : backgroundImage.getComponent(Sprite)) != null ? _backgroundImage$getC2 : null;
          var rootTransform = (_this$rootNode$getCom6 = (_this$rootNode2 = this.rootNode) == null ? void 0 : _this$rootNode2.getComponent(UITransform)) != null ? _this$rootNode$getCom6 : null;
          if (!background || !backgroundTransform || !rootTransform) {
            return;
          }
          backgroundTransform.setContentSize(rootTransform.width, rootTransform.height);
          if (this.backgroundSpriteFrame && backgroundImage && backgroundImageTransform && backgroundImageSprite) {
            backgroundImage.active = true;
            this.fitBackgroundImage(backgroundImageTransform, backgroundImageSprite, rootTransform.width, rootTransform.height);
            return;
          }
          if (backgroundImage) {
            backgroundImage.active = false;
          }
          if (!graphics) {
            return;
          }

          // 未绑定图片时保留旧的低亮点阵背景，避免开发期或资源缺失时首页空白。
          graphics.clear();
          graphics.fillColor = PAGE_BG_COLOR;
          graphics.rect(-rootTransform.width / 2, -rootTransform.height / 2, rootTransform.width, rootTransform.height);
          graphics.fill();
          graphics.fillColor = PAGE_DOT_COLOR;
          var spacing = 42;
          for (var x = -rootTransform.width / 2 + 20; x < rootTransform.width / 2; x += spacing) {
            for (var y = -rootTransform.height / 2 + 20; y < rootTransform.height / 2; y += spacing) {
              graphics.circle(x, y, 1.45);
            }
          }
          graphics.fill();
        }

        /**
         * 按 cover 规则铺满首页背景图。
         *
         * World_3_BG 是竖版大图，直接拉伸会在 Web 横屏预览时变形；这里使用较大的缩放比，
         * 让图片始终保持原始比例并覆盖完整屏幕，多出的部分交给画布边界裁掉。
         */;
        _proto.fitBackgroundImage = function fitBackgroundImage(backgroundTransform, sprite, screenWidth, screenHeight) {
          var _this$backgroundSprit, _imageSize$width, _imageSize$height;
          var imageSize = (_this$backgroundSprit = this.backgroundSpriteFrame) == null ? void 0 : _this$backgroundSprit.originalSize;
          var imageWidth = (_imageSize$width = imageSize == null ? void 0 : imageSize.width) != null ? _imageSize$width : screenWidth;
          var imageHeight = (_imageSize$height = imageSize == null ? void 0 : imageSize.height) != null ? _imageSize$height : screenHeight;
          var scale = Math.max(screenWidth / imageWidth, screenHeight / imageHeight);
          backgroundTransform.setContentSize(Math.ceil(imageWidth * scale), Math.ceil(imageHeight * scale));
          sprite.spriteFrame = this.backgroundSpriteFrame;
          sprite.type = Sprite.Type.SIMPLE;
          sprite.sizeMode = Sprite.SizeMode.CUSTOM;
          sprite.color = new Color(255, 255, 255, 255);
          sprite.enabled = true;
        };
        _proto.redrawCard = function redrawCard() {
          var _this$pageCardNode$ge6, _this$pageCardNode5;
          var graphics = (_this$pageCardNode$ge6 = (_this$pageCardNode5 = this.pageCardNode) == null ? void 0 : _this$pageCardNode5.getComponent(Graphics)) != null ? _this$pageCardNode$ge6 : null;
          if (!graphics) {
            return;
          }
          graphics.clear();
        };
        _proto.layoutPageContents = function layoutPageContents(cardWidth, cardHeight) {
          var _this$pageCardNode$ge7, _this$pageCardNode$ge8, _this$pageDecorNodes$, _this$pageDecorNodes$2, _this$startButtonNode4, _this$pageCardNode$ge9, _this$pageCardNode$ge10;
          if (!this.pageCardNode) {
            return;
          }
          (_this$pageCardNode$ge7 = this.pageCardNode.getChildByName('TitleCard')) == null || _this$pageCardNode$ge7.setPosition(0, cardHeight * 0.31, 0);
          (_this$pageCardNode$ge8 = this.pageCardNode.getChildByName('TileRow')) == null || _this$pageCardNode$ge8.setPosition(0, cardHeight * 0.08, 0);
          (_this$pageDecorNodes$ = this.pageDecorNodes[0]) == null || _this$pageDecorNodes$.setPosition(-cardWidth * 0.33, cardHeight * 0.34, 0);
          (_this$pageDecorNodes$2 = this.pageDecorNodes[1]) == null || _this$pageDecorNodes$2.setPosition(cardWidth * 0.28, cardHeight * 0.39, 0);
          (_this$startButtonNode4 = this.startButtonNode) == null || _this$startButtonNode4.setPosition(0, -cardHeight * 0.15, 0);
          (_this$pageCardNode$ge9 = this.pageCardNode.getChildByName('ActionBar')) == null || _this$pageCardNode$ge9.setPosition(0, -cardHeight * 0.31, 0);
          (_this$pageCardNode$ge10 = this.pageCardNode.getChildByName('TipText')) == null || _this$pageCardNode$ge10.setPosition(0, -cardHeight * 0.42, 0);
        };
        _proto.buildTitleCard = function buildTitleCard(parent) {
          var card = new Node('TitleCard');
          card.setParent(parent);
          card.addComponent(UITransform).setContentSize(560, 236);
          var graphics = card.addComponent(Graphics);
          graphics.fillColor = new Color(60, 94, 126, 38);
          graphics.roundRect(-246, -96, 492, 170, 42);
          graphics.fill();
          graphics.fillColor = new Color(255, 255, 255, 106);
          graphics.roundRect(-230, -84, 460, 164, 40);
          graphics.fill();
          graphics.fillColor = new Color(255, 247, 219, 226);
          graphics.roundRect(-124, -102, 248, 52, 26);
          graphics.fill();
          this.createTitleAccent(card, 'TitleLeaf', -220, 66, 34, new Color(176, 223, 150, 116));
          this.createTitleAccent(card, 'TitleSun', 220, 70, 42, new Color(246, 231, 153, 118));
          this.createTitleAccent(card, 'TitleDotLeft', -178, -56, 8, new Color(MINT_COLOR.r, MINT_COLOR.g, MINT_COLOR.b, 170));
          this.createTitleAccent(card, 'TitleDotRight', 178, -56, 8, new Color(BLUE_COLOR.r, BLUE_COLOR.g, BLUE_COLOR.b, 168));

          // 标题改为四颗数字块，呼应玩法里的数字合成，同时比单行字标更有首页记忆点。
          this.createTitleDigit(card, '1', -156, 18, new Color(255, 105, 151, 255));
          this.createTitleDigit(card, '0', -52, 26, new Color(255, 172, 84, 255));
          this.createTitleDigit(card, '2', 52, 18, new Color(68, 194, 222, 255));
          this.createTitleDigit(card, '4', 156, 26, new Color(103, 205, 116, 255));
          var subtitle = this.createCapsule(card, 'SubtitleBadge', '数字花园', 0, -76, 214, 42, new Color(255, 247, 219, 0), new Color(164, 78, 72, 255));
          subtitle.fontSize = 25;
          subtitle.lineHeight = 32;
          subtitle.isBold = true;
        };
        _proto.createTitleDigit = function createTitleDigit(parent, text, x, y, color) {
          var _label$node$getCompon;
          var node = new Node("TitleDigit" + text);
          node.setParent(parent);
          node.setPosition(x, y, 0);
          node.addComponent(UITransform).setContentSize(92, 104);
          var graphics = node.addComponent(Graphics);
          graphics.fillColor = new Color(50, 88, 102, 50);
          graphics.roundRect(-46, -58, 92, 104, 22);
          graphics.fill();
          graphics.fillColor = color;
          graphics.roundRect(-46, -48, 92, 104, 22);
          graphics.fill();
          graphics.lineWidth = 4;
          graphics.strokeColor = new Color(255, 255, 255, 150);
          graphics.roundRect(-42, -44, 84, 96, 19);
          graphics.stroke();
          var label = this.createLabel(node, 'Value', text, 60, LIGHT_TEXT, new Vec3(0, 4, 0));
          label.isBold = true;
          label.lineHeight = 66;
          (_label$node$getCompon = label.node.getComponent(UITransform)) == null || _label$node$getCompon.setContentSize(92, 86);
        };
        _proto.createTitleAccent = function createTitleAccent(parent, name, x, y, radius, color) {
          var node = new Node(name);
          node.setParent(parent);
          node.setPosition(x, y, 0);
          node.addComponent(UITransform).setContentSize(radius * 2, radius * 2);
          var graphics = node.addComponent(Graphics);
          graphics.fillColor = color;
          graphics.circle(0, 0, radius);
          graphics.fill();
        };
        _proto.buildFloatingTiles = function buildFloatingTiles(parent) {
          var row = new Node('TileRow');
          row.setParent(parent);
          row.addComponent(UITransform).setContentSize(560, 170);

          // 首页数字棋子降低饱和度，保留活泼感但减少高亮色块带来的刺眼感。
          var config = [{
            size: 74,
            label: '2',
            color: new Color(234, 124, 194, 255)
          }, {
            size: 76,
            label: '4',
            color: new Color(105, 82, 210, 255)
          }, {
            size: 78,
            label: '8',
            color: new Color(146, 92, 188, 255)
          }, {
            size: 84,
            label: '16',
            color: new Color(24, 194, 190, 255)
          }, {
            size: 84,
            label: '32',
            color: new Color(88, 178, 220, 255)
          }, {
            size: 84,
            label: '64',
            color: new Color(122, 203, 101, 255)
          }, {
            size: 86,
            label: '128',
            color: new Color(222, 104, 108, 255)
          }, {
            size: 92,
            label: '1024',
            color: new Color(234, 162, 84, 255)
          }];
          var step = 138;
          var trackWidth = step * config.length;
          var startX = -280;
          var trackA = this.createTileTrack(row, 'TileTrackA', config, startX, step);
          var trackB = this.createTileTrack(row, 'TileTrackB', config, startX + trackWidth, step);
          var duration = 11.4;
          tween(trackA).repeatForever(tween().sequence(tween().to(duration, {
            position: new Vec3(startX - trackWidth, 0, 0)
          }, {
            easing: 'linear'
          }), tween().set({
            position: new Vec3(startX, 0, 0)
          }))).start();
          tween(trackB).repeatForever(tween().sequence(tween().to(duration, {
            position: new Vec3(startX, 0, 0)
          }, {
            easing: 'linear'
          }), tween().set({
            position: new Vec3(startX + trackWidth, 0, 0)
          }))).start();
        };
        _proto.createTileTrack = function createTileTrack(parent, name, config, x, step) {
          var track = new Node(name);
          track.setParent(parent);
          track.setPosition(x, 0, 0);
          track.addComponent(UITransform).setContentSize(step * config.length, 170);
          for (var _iterator = _createForOfIteratorHelperLoose(config.entries()), _step; !(_step = _iterator()).done;) {
            var _step$value = _step.value,
              index = _step$value[0],
              item = _step$value[1];
            var tile = new Node("Tile" + item.label);
            tile.setParent(track);
            var baseX = index * step;
            var baseY = index % 2 === 0 ? 0 : 18;
            tile.setPosition(baseX, baseY, 0);
            tile.addComponent(UITransform).setContentSize(item.size, item.size);
            var graphics = tile.addComponent(Graphics);
            graphics.fillColor = item.color;
            graphics.roundRect(-item.size / 2, -item.size / 2, item.size, item.size, 18);
            graphics.fill();
            var label = this.createLabel(tile, 'Value', item.label, item.label.length >= 4 ? 34 : 38, LIGHT_TEXT, Vec3.ZERO);
            label.isBold = true;
            tween(tile).delay(index * 0.22).repeatForever(tween().sequence(tween().to(0.24, {
              position: new Vec3(baseX - 8, baseY + 24, 0)
            }, {
              easing: 'quadOut'
            }), tween().to(0.3, {
              position: new Vec3(baseX - 18, baseY, 0)
            }, {
              easing: 'bounceOut'
            }), tween().delay(1.06), tween().set({
              position: new Vec3(baseX, baseY, 0)
            }))).start();
          }
          return track;
        };
        _proto.createStartButton = function createStartButton(parent) {
          var _shadow$node$getCompo, _label$node$getCompon2;
          var buttonNode = new Node('StartButton');
          buttonNode.setParent(parent);
          buttonNode.addComponent(UITransform).setContentSize(START_BUTTON_WIDTH, START_BUTTON_HEIGHT);
          buttonNode.addComponent(UIOpacity);

          // 开始按钮使用纯文字胶囊样式，不放图标，避免主入口和底部图片按钮抢视觉层级。
          var graphics = buttonNode.addComponent(Graphics);
          graphics.fillColor = new Color(105, 54, 90, 72);
          graphics.roundRect(-START_BUTTON_WIDTH / 2 + 2, -START_BUTTON_HEIGHT / 2 - 8, START_BUTTON_WIDTH - 4, START_BUTTON_HEIGHT, START_BUTTON_HEIGHT / 2);
          graphics.fill();
          graphics.fillColor = new Color(255, 70, 115, 255);
          graphics.roundRect(-START_BUTTON_WIDTH / 2, -START_BUTTON_HEIGHT / 2, START_BUTTON_WIDTH, START_BUTTON_HEIGHT, START_BUTTON_HEIGHT / 2);
          graphics.fill();
          graphics.fillColor = new Color(255, 103, 144, 255);
          graphics.roundRect(-START_BUTTON_WIDTH / 2 + 18, 9, START_BUTTON_WIDTH - 36, 20, 10);
          graphics.fill();
          var shadow = this.createLabel(buttonNode, 'LabelShadow', '开始游戏', 38, new Color(128, 31, 58, 116), new Vec3(0, -4, 0));
          shadow.isBold = true;
          (_shadow$node$getCompo = shadow.node.getComponent(UITransform)) == null || _shadow$node$getCompo.setContentSize(START_BUTTON_WIDTH, 58);
          var label = this.createLabel(buttonNode, 'Label', '开始游戏', 38, LIGHT_TEXT, new Vec3(0, 1, 0));
          label.isBold = true;
          (_label$node$getCompon2 = label.node.getComponent(UITransform)) == null || _label$node$getCompon2.setContentSize(START_BUTTON_WIDTH, 58);
          tween(buttonNode).repeatForever(tween().sequence(tween().to(1.15, {
            scale: new Vec3(1.025, 1.025, 1)
          }, {
            easing: 'sineInOut'
          }), tween().to(1.15, {
            scale: Vec3.ONE
          }, {
            easing: 'sineInOut'
          }))).start();
          return buttonNode;
        };
        _proto.buildActionButtons = function buildActionButtons(parent) {
          var bar = new Node('ActionBar');
          bar.setParent(parent);
          bar.addComponent(UITransform).setContentSize(300, 96);

          // 底部入口统一使用现成图片资源，减少文字按钮造成的视觉重量。
          this.rankButtonNode = this.createActionIconButton(bar, 'RankButton', this.rankButtonSpriteFrame, '榜');
          this.shareButtonNode = this.createActionIconButton(bar, 'ShareButton', this.shareButtonSpriteFrame, '享');
          this.rankButtonNode.setPosition(-ACTION_ICON_PAIR_OFFSET, 0, 0);
          this.shareButtonNode.setPosition(ACTION_ICON_PAIR_OFFSET, 0, 0);
        };
        _proto.createActionIconButton = function createActionIconButton(parent, name, spriteFrame, fallbackText) {
          var buttonNode = new Node(name);
          buttonNode.setParent(parent);
          var transform = buttonNode.addComponent(UITransform);
          transform.setContentSize(ACTION_ICON_WIDTH, ACTION_ICON_HEIGHT);
          buttonNode.addComponent(UIOpacity);
          if (spriteFrame) {
            var sprite = buttonNode.addComponent(Sprite);
            sprite.type = Sprite.Type.SIMPLE;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = spriteFrame;
            // 设置 SpriteFrame 后再同步一次尺寸，避免 Sprite 按原图尺寸覆盖图标按钮大小。
            transform.setContentSize(ACTION_ICON_WIDTH, ACTION_ICON_HEIGHT);
          } else {
            var _label$node$getCompon3;
            // 图标资源缺失时给一个简化占位，避免按钮热区存在但没有可见内容。
            var graphics = buttonNode.addComponent(Graphics);
            graphics.fillColor = new Color(255, 93, 135, 235);
            graphics.roundRect(-ACTION_ICON_WIDTH / 2, -ACTION_ICON_HEIGHT / 2, ACTION_ICON_WIDTH, ACTION_ICON_HEIGHT, 30);
            graphics.fill();
            var label = this.createLabel(buttonNode, 'FallbackLabel', fallbackText, 30, LIGHT_TEXT, Vec3.ZERO);
            label.isBold = true;
            (_label$node$getCompon3 = label.node.getComponent(UITransform)) == null || _label$node$getCompon3.setContentSize(ACTION_ICON_WIDTH, ACTION_ICON_HEIGHT);
          }
          return buttonNode;
        };
        _proto.createPrimaryButton = function createPrimaryButton(parent, name, text, fillColor, y) {
          var _label$node$getCompon4;
          var buttonNode = new Node(name);
          buttonNode.setParent(parent);
          buttonNode.setPosition(0, y, 0);
          var isStartButton = name === 'StartButton';
          var isRankButton = name === 'RankButton';
          var width = isStartButton ? 430 : isRankButton ? 292 : 320;
          var height = isStartButton ? 86 : isRankButton ? 62 : 68;
          var radius = height / 2;
          // 首页按钮分清主次：开始游戏保留光效，排行榜降级为轻描边按钮。
          buttonNode.addComponent(UITransform).setContentSize(width, height);
          buttonNode.addComponent(UIOpacity);
          if (isStartButton) {
            this.createButtonGlow(buttonNode, width, height, radius, fillColor);
          }
          var body = new Node('Body');
          body.setParent(buttonNode);
          body.addComponent(UITransform).setContentSize(width, height);
          var bodyGraphics = body.addComponent(Graphics);
          bodyGraphics.fillColor = isRankButton ? new Color(243, 249, 247, 190) : fillColor;
          bodyGraphics.roundRect(-width / 2, -height / 2, width, height, radius);
          bodyGraphics.fill();
          bodyGraphics.lineWidth = isRankButton ? 2 : 3;
          bodyGraphics.strokeColor = isRankButton ? new Color(fillColor.r, fillColor.g, fillColor.b, 108) : new Color(255, 255, 255, 62);
          bodyGraphics.roundRect(-width / 2 + 1.5, -height / 2 + 1.5, width - 3, height - 3, radius - 1.5);
          bodyGraphics.stroke();
          if (isStartButton) {
            this.createButtonSpark(buttonNode, 'SparkLeft', -width / 2 + 52, height / 2 - 16, 8);
            this.createButtonSpark(buttonNode, 'SparkRight', width / 2 - 58, -height / 2 + 18, 6);
          }
          var labelColor = isRankButton ? new Color(fillColor.r, fillColor.g, fillColor.b, 255) : LIGHT_TEXT;
          var label = this.createLabel(buttonNode, 'Label', text, isStartButton ? 39 : isRankButton ? 28 : 31, labelColor, Vec3.ZERO);
          label.isBold = true;
          (_label$node$getCompon4 = label.node.getComponent(UITransform)) == null || _label$node$getCompon4.setContentSize(width, height);
          if (isStartButton) {
            tween(buttonNode).repeatForever(tween().sequence(tween().to(1.25, {
              scale: new Vec3(1.015, 1.015, 1)
            }, {
              easing: 'sineInOut'
            }), tween().to(1.25, {
              scale: Vec3.ONE
            }, {
              easing: 'sineInOut'
            }))).start();
          }
          return buttonNode;
        };
        _proto.createButtonGlow = function createButtonGlow(parent, width, height, radius, color) {
          var glow = new Node('Glow');
          glow.setParent(parent);
          glow.addComponent(UITransform).setContentSize(width + 28, height + 22);
          var opacity = glow.addComponent(UIOpacity);
          opacity.opacity = 92;
          var graphics = glow.addComponent(Graphics);
          graphics.fillColor = new Color(color.r, color.g, color.b, 20);
          graphics.roundRect(-(width + 28) / 2, -(height + 22) / 2, width + 28, height + 22, radius + 11);
          graphics.fill();
          graphics.fillColor = new Color(255, 255, 255, 16);
          graphics.roundRect(-(width + 8) / 2, -(height + 4) / 2, width + 8, height + 4, radius + 2);
          graphics.fill();
          // 柔光只做原地呼吸，不产生方向性，避免误导玩家去滑动按钮。
          tween(opacity).repeatForever(tween().sequence(tween().to(1.35, {
            opacity: 145
          }, {
            easing: 'sineInOut'
          }), tween().to(1.35, {
            opacity: 82
          }, {
            easing: 'sineInOut'
          }))).start();
        };
        _proto.createButtonSpark = function createButtonSpark(parent, name, x, y, radius) {
          var spark = new Node(name);
          spark.setParent(parent);
          spark.setPosition(x, y, 0);
          spark.addComponent(UITransform).setContentSize(radius * 2, radius * 2);
          var opacity = spark.addComponent(UIOpacity);
          opacity.opacity = 74;
          var graphics = spark.addComponent(Graphics);
          graphics.fillColor = new Color(255, 255, 255, 118);
          graphics.circle(0, 0, radius);
          graphics.fill();
          tween(spark).repeatForever(tween().sequence(tween().to(1.15, {
            scale: new Vec3(1.35, 1.35, 1)
          }, {
            easing: 'sineInOut'
          }), tween().to(1.15, {
            scale: Vec3.ONE
          }, {
            easing: 'sineInOut'
          }))).start();
          tween(opacity).repeatForever(tween().sequence(tween().to(1.15, {
            opacity: 132
          }, {
            easing: 'sineInOut'
          }), tween().to(1.15, {
            opacity: 62
          }, {
            easing: 'sineInOut'
          }))).start();
        };
        _proto.buildTipText = function buildTipText(parent) {
          var tipNode = new Node('TipText');
          tipNode.setParent(parent);
          tipNode.addComponent(UITransform).setContentSize(520, 48);
          this.tipOpacity = tipNode.addComponent(UIOpacity);
          this.tipOpacity.opacity = 255;
          var label = tipNode.addComponent(Label);
          label.string = this.pickNextTip();
          label.fontSize = 22;
          label.lineHeight = 28;
          label.color = SUBTEXT_COLOR;
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
          this.tipLabel = label;
        };
        _proto.startTipRotation = function startTipRotation() {
          var _this5 = this;
          if (!this.tipOpacity || !this.tipLabel) {
            return;
          }
          Tween.stopAllByTarget(this.tipOpacity);
          tween(this.tipOpacity).repeatForever(tween().sequence(tween().delay(5.2), tween().to(0.28, {
            opacity: 0
          }), tween().call(function () {
            if (_this5.tipLabel) {
              _this5.tipLabel.string = _this5.pickNextTip();
            }
          }), tween().to(0.28, {
            opacity: 255
          }))).start();
        };
        _proto.pickNextTip = function pickNextTip() {
          if (TIP_TEXTS.length <= 1) {
            var _TIP_TEXTS$;
            return (_TIP_TEXTS$ = TIP_TEXTS[0]) != null ? _TIP_TEXTS$ : '';
          }
          var index = Math.floor(Math.random() * TIP_TEXTS.length);
          if (index === this.currentTipIndex) {
            index = (index + 1) % TIP_TEXTS.length;
          }
          this.currentTipIndex = index;
          return TIP_TEXTS[index];
        };
        _proto.buildRankModal = function buildRankModal(parent) {
          var _this6 = this;
          var mask = new Node('RankMask');
          mask.setParent(parent);
          mask.addComponent(UITransform);
          mask.addComponent(UIOpacity).opacity = 0;
          mask.active = false;
          this.rankMaskNode = mask;
          mask.addComponent(Graphics);
          var panel = new Node('RankPanel');
          panel.setParent(mask);
          panel.addComponent(UITransform).setContentSize(470, 760);
          panel.addComponent(Graphics);
          this.bindSwallowTouch(panel);
          this.rankPanelNode = panel;
          this.rankCloseButtonNode = this.createCircleButton(panel, 'CloseButton', '×', 184, 322, 40);
          var title = this.createLabel(panel, 'Title', '好友排行榜', 40, TEAL_COLOR, new Vec3(0, 282, 0));
          title.isBold = true;
          var badge = this.createCapsule(panel, 'Badge', '本周合成之星', 0, 230, 188, 38, new Color(242, 252, 255, 255), SUBTEXT_COLOR);
          badge.fontSize = 18;
          this.buildPodium(panel);
          this.buildRankList(panel);
          var invite = this.createPrimaryButton(panel, 'InviteBtn', '邀请好友', BLUE_COLOR, -318);
          invite.on(Node.EventType.TOUCH_END, function (event) {
            event.propagationStopped = true;
            _this6.showToast('邀请功能待小游戏能力接入');
          });
        };
        _proto.buildPodium = function buildPodium(parent) {
          var _this7 = this;
          var top3 = RANKING_DATA.slice(0, 3);
          // 前三名整体上移并缩小头像块，给下方列表和按钮留出明确间距。
          var positions = [{
            x: 0,
            y: 142,
            size: 86
          }, {
            x: -126,
            y: 108,
            size: 66
          }, {
            x: 126,
            y: 108,
            size: 66
          }];
          top3.forEach(function (entry, index) {
            var holder = new Node("Top" + entry.rank);
            holder.setParent(parent);
            holder.setPosition(positions[index].x, positions[index].y, 0);
            holder.addComponent(UITransform).setContentSize(118, 136);
            var bubble = holder.addComponent(Graphics);
            var size = positions[index].size;
            bubble.fillColor = entry.color;
            bubble.roundRect(-size / 2, -size / 2 + 20, size, size, 24);
            bubble.fill();
            if (entry.rank === 1) {
              bubble.fillColor = new Color(255, 209, 105, 255);
              bubble.circle(0, size / 2 + 20, 21);
              bubble.fill();
            }
            var rankLabel = _this7.createLabel(holder, 'Rank', "" + entry.rank, 24, TEAL_COLOR, new Vec3(0, 20, 0));
            rankLabel.isBold = true;
            var nameLabel = _this7.createLabel(holder, 'Name', entry.name, 21, TEAL_COLOR, new Vec3(0, -38, 0));
            nameLabel.isBold = true;
            var scoreLabel = _this7.createLabel(holder, 'Score', "" + entry.score, index === 0 ? 34 : 24, TEAL_COLOR, new Vec3(0, -68, 0));
            scoreLabel.isBold = true;
          });
        };
        _proto.buildRankList = function buildRankList(parent) {
          var _this8 = this;
          var entries = RANKING_DATA.slice(3);
          entries.forEach(function (entry, index) {
            var _rankLabel$node$getCo, _nameLabel$node$getCo, _scoreLabel$node$getC;
            var row = new Node("Row" + entry.rank);
            row.setParent(parent);
            // 列表行改成更紧凑的卡片，并和底部按钮拉开距离，避免小屏下互相遮挡。
            row.setPosition(0, -38 - index * 74, 0);
            row.addComponent(UITransform).setContentSize(374, 58);
            var graphics = row.addComponent(Graphics);
            graphics.fillColor = new Color(255, 255, 255, 218);
            graphics.roundRect(-187, -29, 374, 58, 22);
            graphics.fill();
            graphics.fillColor = entry.color;
            graphics.circle(-118, 0, 16);
            graphics.fill();
            var rankLabel = _this8.createLabel(row, 'Rank', "" + entry.rank, 22, SUBTEXT_COLOR, new Vec3(-162, 0, 0));
            rankLabel.isBold = true;
            (_rankLabel$node$getCo = rankLabel.node.getComponent(UITransform)) == null || _rankLabel$node$getCo.setContentSize(44, 44);
            var nameLabel = _this8.createLabel(row, 'Name', entry.name, 21, TEAL_COLOR, new Vec3(-40, 0, 0));
            nameLabel.isBold = true;
            (_nameLabel$node$getCo = nameLabel.node.getComponent(UITransform)) == null || _nameLabel$node$getCo.setContentSize(150, 44);
            var scoreLabel = _this8.createLabel(row, 'Score', "" + entry.score, 21, new Color(89, 188, 163, 255), new Vec3(126, 0, 0));
            scoreLabel.isBold = true;
            (_scoreLabel$node$getC = scoreLabel.node.getComponent(UITransform)) == null || _scoreLabel$node$getC.setContentSize(116, 44);
          });
        };
        _proto.buildToast = function buildToast(parent) {
          var toast = new Node('Toast');
          toast.setParent(parent);
          toast.addComponent(UITransform).setContentSize(360, 72);
          toast.addComponent(Graphics);
          toast.addComponent(UIOpacity).opacity = 0;
          toast.active = false;
          toast.on(Node.EventType.TOUCH_END, this.consumeTouch, this);
          var label = this.createLabel(toast, 'Label', '', 22, LIGHT_TEXT, Vec3.ZERO);
          label.isBold = true;
          this.toastNode = toast;
          this.toastOpacity = toast.getComponent(UIOpacity);
        };
        _proto.layoutRankModal = function layoutRankModal(width, height) {
          if (!this.rankMaskNode || !this.rankPanelNode) {
            return;
          }
          var maskTransform = this.rankMaskNode.getComponent(UITransform);
          var panelTransform = this.rankPanelNode.getComponent(UITransform);
          var panelGraphics = this.rankPanelNode.getComponent(Graphics);
          if (!maskTransform) {
            return;
          }
          maskTransform.setContentSize(width, height);
          this.refreshRankMaskStyle();
          if (this.usesHierarchyNodes) {
            return;
          }
          if (!panelTransform || !panelGraphics) {
            return;
          }
          panelTransform.setContentSize(Math.min(470, width - 90), Math.min(760, height - 180));
          panelGraphics.clear();
          panelGraphics.fillColor = new Color(186, 225, 232, 64);
          panelGraphics.roundRect(-panelTransform.width / 2 - 4, -panelTransform.height / 2 - 6, panelTransform.width + 8, panelTransform.height + 12, 28);
          panelGraphics.fill();
          panelGraphics.fillColor = new Color(242, 253, 255, 248);
          panelGraphics.roundRect(-panelTransform.width / 2, -panelTransform.height / 2, panelTransform.width, panelTransform.height, 28);
          panelGraphics.fill();
        }

        // 排行榜遮罩根据打开来源切换颜色：首页为浅雾化，暂停页为透明，保留原暂停暗色遮罩。
        ;

        _proto.refreshRankMaskStyle = function refreshRankMaskStyle() {
          var _this$rankMaskNode, _this$rankMaskNode2;
          var maskTransform = (_this$rankMaskNode = this.rankMaskNode) == null ? void 0 : _this$rankMaskNode.getComponent(UITransform);
          var maskGraphics = (_this$rankMaskNode2 = this.rankMaskNode) == null ? void 0 : _this$rankMaskNode2.getComponent(Graphics);
          if (!maskTransform || !maskGraphics) {
            return;
          }
          var width = maskTransform.width;
          var height = maskTransform.height;
          maskGraphics.clear();
          maskGraphics.fillColor = this.isRankOnlyMode ? RANK_MASK_PAUSE_COLOR : RANK_MASK_HOME_COLOR;
          maskGraphics.rect(-width / 2, -height / 2, width, height);
          maskGraphics.fill();
        };
        _proto.createCircleDecoration = function createCircleDecoration(parent, name, radius, color, alphaScale) {
          var node = new Node(name);
          node.setParent(parent);
          node.addComponent(UITransform).setContentSize(radius * 2, radius * 2);
          var graphics = node.addComponent(Graphics);
          graphics.fillColor = new Color(color.r, color.g, color.b, Math.round(color.a * alphaScale));
          graphics.circle(0, 0, radius);
          graphics.fill();
          tween(node).repeatForever(tween().sequence(tween().to(2, {
            scale: new Vec3(1.06, 1.06, 1)
          }, {
            easing: 'sineInOut'
          }), tween().to(2, {
            scale: Vec3.ONE
          }, {
            easing: 'sineInOut'
          }))).start();
          return node;
        };
        _proto.createCircleButton = function createCircleButton(parent, name, text, x, y, radius) {
          var node = new Node(name);
          node.setParent(parent);
          node.setPosition(x, y, 0);
          node.addComponent(UITransform).setContentSize(radius * 2, radius * 2);
          var graphics = node.addComponent(Graphics);
          graphics.fillColor = new Color(255, 255, 255, 248);
          graphics.circle(0, 0, radius);
          graphics.fill();
          var label = this.createLabel(node, 'Label', text, 26, TEAL_COLOR, Vec3.ZERO);
          label.isBold = true;
          return node;
        };
        _proto.createCapsule = function createCapsule(parent, name, text, x, y, width, height, fillColor, textColor) {
          var node = new Node(name);
          node.setParent(parent);
          node.setPosition(x, y, 0);
          node.addComponent(UITransform).setContentSize(width, height);
          var graphics = node.addComponent(Graphics);
          graphics.fillColor = fillColor;
          graphics.roundRect(-width / 2, -height / 2, width, height, height / 2);
          graphics.fill();
          var label = this.createLabel(node, 'Label', text, 20, textColor, Vec3.ZERO);
          label.isBold = true;
          return label;
        };
        _proto.createLabel = function createLabel(parent, name, text, fontSize, color, position) {
          var node = new Node(name);
          node.setParent(parent);
          node.setPosition(position);
          node.addComponent(UITransform).setContentSize(420, 56);
          var label = node.addComponent(Label);
          label.string = text;
          label.fontSize = fontSize;
          label.lineHeight = fontSize + 6;
          label.color = color;
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
          return label;
        }

        // 层级管理器里的节点可能多包了一层容器，这里做递归查找来减少拖引用的硬性要求。
        ;

        _proto.findChildDeep = function findChildDeep(parent, name) {
          var directChild = parent.getChildByName(name);
          if (directChild) {
            return directChild;
          }
          for (var _iterator2 = _createForOfIteratorHelperLoose(parent.children), _step2; !(_step2 = _iterator2()).done;) {
            var child = _step2.value;
            var matched = this.findChildDeep(child, name);
            if (matched) {
              return matched;
            }
          }
          return null;
        };
        _proto.bindPressableButton = function bindPressableButton(node, endHandler) {
          if (!this.canUseNode(node)) {
            return;
          }
          node.on(Node.EventType.TOUCH_START, this.handleButtonPressStart, this);
          node.on(Node.EventType.TOUCH_END, this.handleButtonPressEnd, this);
          node.on(Node.EventType.TOUCH_CANCEL, this.handleButtonPressEnd, this);
          node.on(Node.EventType.TOUCH_END, endHandler, this);
        };
        _proto.unbindPressableButton = function unbindPressableButton(node, endHandler) {
          if (!this.canUseNode(node)) {
            return;
          }
          node.off(Node.EventType.TOUCH_START, this.handleButtonPressStart, this);
          node.off(Node.EventType.TOUCH_END, this.handleButtonPressEnd, this);
          node.off(Node.EventType.TOUCH_CANCEL, this.handleButtonPressEnd, this);
          node.off(Node.EventType.TOUCH_END, endHandler, this);
        }

        // 资源条本身已有 0.55 缩放，使用独立按压动画避免复用普通按钮时被恢复成 1 倍。
        ;

        _proto.bindAmountBar = function bindAmountBar(node, endHandler) {
          if (!this.canUseNode(node)) {
            return;
          }
          node.on(Node.EventType.TOUCH_START, this.handleAmountBarPressStart, this);
          node.on(Node.EventType.TOUCH_END, this.handleAmountBarPressEnd, this);
          node.on(Node.EventType.TOUCH_CANCEL, this.handleAmountBarPressEnd, this);
          node.on(Node.EventType.TOUCH_END, endHandler, this);
        };
        _proto.unbindAmountBar = function unbindAmountBar(node, endHandler) {
          if (!this.canUseNode(node)) {
            return;
          }
          node.off(Node.EventType.TOUCH_START, this.handleAmountBarPressStart, this);
          node.off(Node.EventType.TOUCH_END, this.handleAmountBarPressEnd, this);
          node.off(Node.EventType.TOUCH_CANCEL, this.handleAmountBarPressEnd, this);
          node.off(Node.EventType.TOUCH_END, endHandler, this);
        }

        // 切场景时节点可能已经进入销毁流程，解绑前先确认引用仍可安全使用。
        ;

        _proto.canUseNode = function canUseNode(node) {
          return !!node && node.isValid;
        };
        _proto.safeOff = function safeOff(node, eventType, handler) {
          if (!this.canUseNode(node)) {
            return;
          }
          node.off(eventType, handler, this);
        };
        _proto.safeOn = function safeOn(node, eventType, handler) {
          if (!this.canUseNode(node)) {
            return;
          }
          node.on(eventType, handler, this);
        }

        // setSiblingIndex 依赖节点仍在父节点下；场景切换时先判断，避免触发引擎内部空 parent。
        ;

        _proto.bringNodeToTop = function bringNodeToTop(node) {
          var _node$parent;
          var parent = (_node$parent = node == null ? void 0 : node.parent) != null ? _node$parent : null;
          if (!this.canUseNode(node) || !(parent != null && parent.isValid)) {
            return;
          }
          node.setSiblingIndex(parent.children.length - 1);
        }

        // 首页离开或销毁时停止所有面板动画，避免 tween 在节点销毁后继续写属性。
        ;

        _proto.stopPageTweens = function stopPageTweens() {
          this.stopNodeTreeTweens(this.rootNode);
        };
        _proto.stopNodeTreeTweens = function stopNodeTreeTweens(node) {
          if (!this.canUseNode(node)) {
            return;
          }
          Tween.stopAllByTarget(node);
          var opacity = node.getComponent(UIOpacity);
          if (opacity) {
            Tween.stopAllByTarget(opacity);
          }
          for (var _i = 0, _arr = [].concat(node.children); _i < _arr.length; _i++) {
            var child = _arr[_i];
            this.stopNodeTreeTweens(child);
          }
        }

        // 所有首页按钮共用轻微按压反馈，保证图片按钮和开始按钮的交互手感一致。
        ;

        _proto.handleButtonPressStart = function handleButtonPressStart(event) {
          var node = event.currentTarget;
          if (this.canUseNode(node)) {
            node.setScale(new Vec3(0.94, 0.94, 1));
          }
        };
        _proto.handleButtonPressEnd = function handleButtonPressEnd(event) {
          var node = event.currentTarget;
          if (this.canUseNode(node)) {
            node.setScale(Vec3.ONE);
          }
        };
        _proto.handleAmountBarPressStart = function handleAmountBarPressStart(event) {
          var node = event.currentTarget;
          if (this.canUseNode(node)) {
            node.setScale(AMOUNT_BAR_SCALE * 0.94, AMOUNT_BAR_SCALE * 0.94, 1);
          }
        };
        _proto.handleAmountBarPressEnd = function handleAmountBarPressEnd(event) {
          var node = event.currentTarget;
          if (this.canUseNode(node)) {
            node.setScale(AMOUNT_BAR_SCALE, AMOUNT_BAR_SCALE, 1);
          }
        };
        _proto.handleStartTap = function handleStartTap(event) {
          var _this$startHandler;
          event.propagationStopped = true;
          (_this$startHandler = this.startHandler) == null || _this$startHandler.call(this);
        };
        _proto.handleRankTap = function handleRankTap(event) {
          event.propagationStopped = true;
          // 排行榜能力暂未接入，首页入口先给轻提示，避免误打开假数据榜单。
          this.showToast('暂未开放');
        };
        _proto.handleRankCloseTap = function handleRankCloseTap(event) {
          event.propagationStopped = true;
          this.hideRankModal();
        };
        _proto.handleShareTap = function handleShareTap(event) {
          var _this$shareHandler;
          event.propagationStopped = true;
          (_this$shareHandler = this.shareHandler) == null || _this$shareHandler.call(this);
        };
        _proto.handleEnergyMoreTap = function handleEnergyMoreTap(event) {
          var _this$energyMoreHandl;
          event.propagationStopped = true;
          (_this$energyMoreHandl = this.energyMoreHandler) == null || _this$energyMoreHandl.call(this);
        };
        _proto.hideRankModal = function hideRankModal(event) {
          var _this$rankMaskNode$ge2,
            _this9 = this;
          if (event) {
            event.propagationStopped = true;
          }
          if (!this.rankMaskNode) {
            return;
          }
          var opacity = (_this$rankMaskNode$ge2 = this.rankMaskNode.getComponent(UIOpacity)) != null ? _this$rankMaskNode$ge2 : this.rankMaskNode.addComponent(UIOpacity);
          Tween.stopAllByTarget(opacity);
          tween(opacity).to(0.12, {
            opacity: 0
          }).call(function () {
            if (_this9.rankMaskNode) {
              _this9.rankMaskNode.active = false;
            }
            if (_this9.isRankOnlyMode) {
              // 暂停页借用排行榜后，关闭榜单时要把首页根节点重新隐藏，露出原来的暂停遮罩。
              _this9.isRankOnlyMode = false;
              if (_this9.rootNode) {
                var background = _this9.backgroundNode;
                if (background) {
                  background.active = true;
                }
                if (_this9.pageCardNode) {
                  _this9.pageCardNode.active = true;
                }
                _this9.rootNode.active = false;
              }
            }
          }).start();
        };
        _proto.showToast = function showToast(message) {
          var _this$toastNode$getCh,
            _this$toastNode$getCh2,
            _this10 = this;
          if (!this.toastNode || !this.toastOpacity) {
            return;
          }
          var graphics = this.toastNode.getComponent(Graphics);
          var label = (_this$toastNode$getCh = (_this$toastNode$getCh2 = this.toastNode.getChildByName('Label')) == null ? void 0 : _this$toastNode$getCh2.getComponent(Label)) != null ? _this$toastNode$getCh : null;
          var transform = this.toastNode.getComponent(UITransform);
          if (!graphics || !label || !transform) {
            return;
          }
          this.toastNode.active = true;
          this.toastNode.setPosition(0, -520, 0);
          label.string = message;
          graphics.clear();
          graphics.fillColor = new Color(46, 108, 121, 232);
          graphics.roundRect(-transform.width / 2, -transform.height / 2, transform.width, transform.height, 24);
          graphics.fill();
          Tween.stopAllByTarget(this.toastOpacity);
          this.toastOpacity.opacity = 0;
          tween(this.toastOpacity).sequence(tween().to(0.12, {
            opacity: 255
          }), tween().delay(1.2), tween().to(0.12, {
            opacity: 0
          }), tween().call(function () {
            if (_this10.toastNode) {
              _this10.toastNode.active = false;
            }
          })).start();
        };
        _proto.consumeTouch = function consumeTouch(event) {
          event.propagationStopped = true;
        };
        _proto.bindSwallowTouch = function bindSwallowTouch(node) {
          if (!this.canUseNode(node)) {
            return;
          }
          node.off(Node.EventType.TOUCH_START, this.consumeTouch, this);
          node.off(Node.EventType.TOUCH_MOVE, this.consumeTouch, this);
          node.off(Node.EventType.TOUCH_END, this.consumeTouch, this);
          node.off(Node.EventType.TOUCH_CANCEL, this.consumeTouch, this);
          node.on(Node.EventType.TOUCH_START, this.consumeTouch, this);
          node.on(Node.EventType.TOUCH_MOVE, this.consumeTouch, this);
          node.on(Node.EventType.TOUCH_END, this.consumeTouch, this);
          node.on(Node.EventType.TOUCH_CANCEL, this.consumeTouch, this);
        };
        return StartPageController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "rootNodeRef", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "pageCardNodeRef", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "backgroundNodeRef", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "backgroundImageNodeRef", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "startButtonNodeRef", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "rankButtonNodeRef", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "settingsButtonNodeRef", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "shareButtonNodeRef", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "rankMaskNodeRef", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "rankPanelNodeRef", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "tipTextNodeRef", [_dec12], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "toastNodeRef", [_dec13], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/TransientFxRegistry.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, Tween, UIOpacity;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      Tween = module.Tween;
      UIOpacity = module.UIOpacity;
    }],
    execute: function () {
      cclegacy._RF.push({}, "20c60nOurFBGKU4APuAWr/U", "TransientFxRegistry", undefined);

      // 统一登记临时特效节点，便于返回首页、重开或超量时做收口清理。
      var TransientFxRegistry = exports('TransientFxRegistry', /*#__PURE__*/function () {
        function TransientFxRegistry(maxActiveCount) {
          this.activeNodes = new Set();
          this.maxActiveCount = maxActiveCount;
        }
        var _proto = TransientFxRegistry.prototype;
        _proto.canRegister = function canRegister(count) {
          return this.activeNodes.size + count <= this.maxActiveCount;
        };
        _proto.register = function register(node) {
          this.activeNodes.add(node);
        }

        // 特效自然结束时从集合移除并销毁节点，避免集合里残留无效引用。
        ;

        _proto.destroy = function destroy(node) {
          this.activeNodes["delete"](node);
          node.destroy();
        }

        /**
         * 停止并清理所有运行中临时特效。
         *
         * 返回首页、重开或落地前清理拖尾时都会调用这里；清理时会同步停止节点和透明度组件上的 Tween，
         * 避免节点销毁后仍有动画回调访问旧对象。
         */;
        _proto.clear = function clear() {
          for (var _iterator = _createForOfIteratorHelperLoose(this.activeNodes), _step; !(_step = _iterator()).done;) {
            var node = _step.value;
            if (!node.isValid) {
              continue;
            }
            Tween.stopAllByTarget(node);
            var opacity = node.getComponent(UIOpacity);
            if (opacity) {
              Tween.stopAllByTarget(opacity);
            }
            node.destroy();
          }
          this.activeNodes.clear();
        };
        return TransientFxRegistry;
      }());
      cclegacy._RF.pop();
    }
  };
});

(function(r) {
  r('virtual:///prerequisite-imports/main', 'chunks:///_virtual/main'); 
})(function(mid, cid) {
    System.register(mid, [cid], function (_export, _context) {
    return {
        setters: [function(_m) {
            var _exportObj = {};

            for (var _key in _m) {
              if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _m[_key];
            }
      
            _export(_exportObj);
        }],
        execute: function () { }
    };
    });
});
