import React, {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useCallback,
  useImperativeHandle,
} from 'react';
import Slider from "react-native-slider";
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { WebView } from './WebView';
import { PLAYER_STATES, PLAYER_ERROR, CUSTOM_USER_AGENT } from './constants';
import { EventEmitter } from 'events';
import {
  playMode,
  soundMode,
  MAIN_SCRIPT,
  PLAYER_FUNCTIONS,
} from './PlayerScripts';

const YoutubeIframe = (props, ref) => {
  const {
    height,
    width,
    videoId,
    playList,
    play = false,
    mute = false,
    volume = 100,
    webViewStyle,
    webViewProps,
    playbackRate = 1,
    contentScale = 1.0,
    onError = _err => { },
    onReady = _event => { },
    playListStartIndex = 0,
    initialPlayerParams = {},
    allowWebViewZoom = false,
    forceAndroidAutoplay = false,
    onChangeState = _event => { },
    onFullScreenChange = _status => { },
    onPlaybackQualityChange = _quality => { },
    onPlaybackRateChange = _playbackRate => { },
    allowOnlyPlayPauseOption = false,
    customSliderTrackColor = "grey",
    customSliderThumbColor = "white",
    onCustomSliderChange = null,
    onCustomSliderChangeCompleted = null,
  } = props;

  const insertIf = (condition, ...elements) => { // (A)
    return condition ? elements : [];
  }

  const [playpauseonly, setPlayPause] = useState(play);
  const [playpausesingletap, setPlayPauseSingleTap] = useState(false);
  const [canSlide, setSliderVisibility] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(0);
  const webViewRef = useRef(null);
  const eventEmitter = useRef(new EventEmitter());
  const [playerReady, setPlayerReady] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      getVideoUrl: () => {
        webViewRef.current.injectJavaScript(PLAYER_FUNCTIONS.getVideoUrlScript);
        return new Promise(resolve => {
          eventEmitter.current.once('getVideoUrl', resolve);
        });
      },
      getDuration: () => {
        webViewRef.current.injectJavaScript(PLAYER_FUNCTIONS.durationScript);
        return new Promise(resolve => {
          eventEmitter.current.once('getDuration', resolve);
        });
      },
      getCurrentTime: () => {
        webViewRef.current.injectJavaScript(PLAYER_FUNCTIONS.currentTimeScript);
        return new Promise(resolve => {
          eventEmitter.current.once('getCurrentTime', resolve);
        });
      },
      isMuted: () => {
        webViewRef.current.injectJavaScript(PLAYER_FUNCTIONS.isMutedScript);
        return new Promise(resolve => {
          eventEmitter.current.once('isMuted', resolve);
        });
      },
      getVolume: () => {
        webViewRef.current.injectJavaScript(PLAYER_FUNCTIONS.getVolumeScript);
        return new Promise(resolve => {
          eventEmitter.current.once('getVolume', resolve);
        });
      },
      getPlaybackRate: () => {
        webViewRef.current.injectJavaScript(
          PLAYER_FUNCTIONS.getPlaybackRateScript,
        );
        return new Promise(resolve => {
          eventEmitter.current.once('getPlaybackRate', resolve);
        });
      },
      getAvailablePlaybackRates: () => {
        webViewRef.current.injectJavaScript(
          PLAYER_FUNCTIONS.getAvailablePlaybackRatesScript,
        );
        return new Promise(resolve => {
          eventEmitter.current.once('getAvailablePlaybackRates', resolve);
        });
      },
      seekTo: (seconds, allowSeekAhead) => {
        webViewRef.current.injectJavaScript(
          PLAYER_FUNCTIONS.seekToScript(seconds, allowSeekAhead),
        );
      },
    }),
    [],
  );

  useEffect(() => {
    if (!playerReady) {
      return;
    }
    [
      playMode[play || playpauseonly],
      soundMode[mute],
      PLAYER_FUNCTIONS.setVolume(volume),
      PLAYER_FUNCTIONS.setPlaybackRate(playbackRate),
    ].forEach(webViewRef.current.injectJavaScript);
  }, [play, playpauseonly, playerReady, mute, volume, playbackRate]);

  const onWebMessage = useCallback(
    event => {
      const message = JSON.parse(event.nativeEvent.data);
      try {
        switch (message.eventType) {
          case 'fullScreenChange':
            onFullScreenChange(message.data);
            break;
          case 'playerStateChange':
            onChangeState(PLAYER_STATES[message.data]);
            break;
          case 'playerReady':
            onReady();
            setPlayerReady(true);
            if (Array.isArray(playList)) {
              webViewRef.current.injectJavaScript(
                PLAYER_FUNCTIONS.loadPlaylist(
                  playList,
                  playListStartIndex,
                  play,
                ),
              );
            }
            break;
          case 'playerQualityChange':
            onPlaybackQualityChange(message.data);
            break;
          case 'playerError':
            onError(PLAYER_ERROR[message.data]);
            break;
          case 'playbackRateChange':
            onPlaybackRateChange(message.data);
            break;
          default:
            eventEmitter.current.emit(message.eventType, message.data);
            break;
        }
      } catch (error) {
        console.warn(error);
      }
    },
    [
      play,
      onReady,
      onError,
      playList,
      onChangeState,
      onFullScreenChange,
      playListStartIndex,
      onPlaybackRateChange,
      onPlaybackQualityChange,
    ],
  );

  const handleCustomSliderChangeCompleted = (event) => {
    if (onCustomSliderChangeCompleted) {
      onCustomSliderChangeCompleted(event);
    }
  }

  const handleCustomSliderChange = (value) => {
    setSliderPosition(value);
    webViewRef.current.injectJavaScript(
      PLAYER_FUNCTIONS.seekToScript(69, true));
    if (onCustomSliderChange) {
      onCustomSliderChange(value);
    }
  }

  const onPlayPauseSingleTap = () => {
    console.log("single tap");
    if (playpauseonly) {
      setPlayPauseSingleTap(!playpausesingletap);
      setSliderVisibility(!canSlide);
    }
    setPlayPause(!playpauseonly);

  };

  const onPlayPauseClick = () => {
    setPlayPause(!playpauseonly);
  };

  let containerCss = [
    styles.playandpauseonly,
    insertIf(playpausesingletap, styles.playandpausesingletap),
  ];
  return (
    <View>
      {allowOnlyPlayPauseOption && (
        <>
          <TouchableOpacity
            style={[containerCss, { height: height }]}
            onPress={onPlayPauseSingleTap}
            onLongPress={onPlayPauseClick}
          />
          {canSlide && <Slider
            style={{
              position: "absolute",
              bottom: 12,
              zIndex: 10,
              width: "100%"
            }}
            thumbStyle={{
              backgroundColor: customSliderThumbColor,
              height: 25,
              borderRadius: 0,

            }}
            trackStyle={{
              backgroundColor: customSliderTrackColor,
              height: 15,
            }}
            value={sliderPosition}
            onValueChange={value => handleCustomSliderChange(value)}
            onSlidingComplete={(event) => handleCustomSliderChangeCompleted(event)}
          />
          }
        </>
      )
      }
      <View style={{ height, width }}>
        <WebView
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          style={[styles.webView, webViewStyle]}
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo={!initialPlayerParams?.preventFullScreen}
          userAgent={
            forceAndroidAutoplay
              ? Platform.select({ android: CUSTOM_USER_AGENT, ios: '' })
              : ''
          }
          onShouldStartLoadWithRequest={request => {
            return request.mainDocumentURL === 'about:blank';
          }}
          bounces={false}
          // props above this are override-able

          // --
          {...webViewProps}
          // --

          //add props that should not be allowed to be overridden below
          ref={webViewRef}
          onMessage={onWebMessage}
          source={{
            // partially allow source to be overridden
            ...webViewProps?.source,
            method: 'GET',
            html: MAIN_SCRIPT(
              videoId,
              playList,
              initialPlayerParams,
              allowWebViewZoom,
              contentScale,
            ),
          }}
        />
      </View>
    </View >
  );
};

const styles = StyleSheet.create({
  webView: { backgroundColor: 'transparent' },
  playandpauseonly: {
    zIndex: 1,
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  playandpausesingletap: {
    // zIndex: 1,
    // position: 'absolute',
    // bottom: 0,
    // width: '100%',
    opacity: 0.1,
    backgroundColor: 'rgba(52, 52, 52, 0.4)'
  },
});

export default forwardRef(YoutubeIframe);
