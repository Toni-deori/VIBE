// Voice interaction handler for blind-friendly navigation

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let rawCommand = message.text.toLowerCase().trim();
  function handleResponse(response) {
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
  
  function handleError(error) {
    console.error('Summarization error:', error);
    speak("There was an error generating the summary. Please try again.");
  }
  // Maps for spoken ordinals and cardinals
  const numberWords = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
    sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
    eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
    sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20,
    thirtieth: 30,
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
    thirty: 30
  };

  function wordToNumber(word) {
    return numberWords[word] ?? (!isNaN(word) ? parseInt(word) : null);
  }

  // Normalize command to unify forms
  function normalizeCommand(cmd) {
    // Replace number words with digits for link commands
    cmd = cmd.replace(/\b(summarize|summarise|summary)\b/g, 'summarize');
    cmd = cmd.replace(/\b(the )?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|thirtieth|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty)\b(?= link)/g, (match) => {
      const word = match.trim().replace(/^the /, '');
      const num = wordToNumber(word);
      return num ? num.toString() : word;
    });

    // Synonyms for scrolling
    cmd = cmd
      .replace(/(go|move|scroll) (down|lower)/g, 'scroll down')
      .replace(/(go|move|scroll) (up|higher)/g, 'scroll up')
      .replace(/(go|move) to top/, 'go to top')
      .replace(/(go|move) to bottom/, 'go to bottom');

    return cmd;
  }

  const command = normalizeCommand(rawCommand);

  function speak(text) {
    window.speechSynthesis.cancel(); // Stops any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  }
  

  function isInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  let visibleLinks = [];

  // GENERAL COMMANDS
  if (command.includes("scroll down")) {
    window.scrollBy({ top: 500, behavior: 'smooth' });
    setTimeout(() => speak("Scrolled down."), 600);

  } else if (command.includes("scroll up")) {
    window.scrollBy({ top: -500, behavior: 'smooth' });
    setTimeout(() => speak("Scrolled up."), 600);

  } else if (command.includes("go to top")) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => speak("Went to the top of the page."), 600);

  } else if (command.includes("go to bottom")) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    setTimeout(() => speak("Went to the bottom of the page."), 600);

  } else if (command.includes("read title")) {
    speak(document.title);

  } else if (command.includes("read first paragraph")) {
    const paragraphs = [...document.querySelectorAll("p")]
      .filter(p => p.innerText.trim().length > 0 && isInViewport(p));
    if (paragraphs.length > 0) {
      speak(paragraphs[0].innerText);
    } else {
      speak("No visible paragraph found.");
    }

  } else if (command.includes("read all text")) {
    const visibleContent = [...document.querySelectorAll("p, li, blockquote, h1, h2, h3, h4")]
      .filter(el =>
        el.innerText.trim().length > 30 &&
        isInViewport(el) &&
        window.getComputedStyle(el).visibility !== "hidden"
      ).slice(0, 10);

    if (visibleContent.length > 0) {
      visibleContent.forEach(el => speak(el.innerText));
    } else {
      speak("No visible readable content found.");
    }

  } else if (command.includes("stop reading")) {
    window.speechSynthesis.cancel();
    speak("Reading stopped");

  } else if (command.includes("read links")) {
    visibleLinks = [...document.querySelectorAll("a")]
      .filter(a => a.innerText.trim().length > 0 && a.offsetParent !== null && isInViewport(a));

    if (visibleLinks.length === 0) {
      speak("No visible links found on this page.");
    } else {
      visibleLinks.forEach((link, i) => {
        const utterance = new SpeechSynthesisUtterance(`${i + 1}. ${link.innerText.trim()}`);
        utterance.rate = 1;
        window.speechSynthesis.speak(utterance);
      });
    }

  } else if (command.match(/click (last|\d+) link/)) {
    const match = command.match(/click (last|\d+) link/);
    const spoken = match[1];

    if (!visibleLinks.length) {
      visibleLinks = [...document.querySelectorAll("a")]
        .filter(a => a.innerText.trim().length > 0 && a.offsetParent !== null && isInViewport(a));
    }

    let index = -1;
    if (spoken === "last") {
      index = visibleLinks.length - 1;
    } else {
      index = parseInt(spoken, 10) - 1;
    }

    const targetLink = visibleLinks[index];
    if (targetLink) {
      speak(`Clicking link ${index + 1}: ${targetLink.innerText.trim()}`);
      targetLink.click();
    } else {
      speak("That link number is not available.");
    }
  }
  // Add to content.js's command handling
// Update in content.js
else if (command.match(/(summarize|summarise|summary)/i)) {
  // Get visible text with better filtering
  const visibleText = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, article, section'))
      .filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && 
                 rect.height > 0 &&
                 window.getComputedStyle(el).visibility === 'visible' &&
                 window.getComputedStyle(el).display !== 'none';
      })
      .map(el => el.innerText.trim())
      .filter(text => text.length > 0)
      .join('\n')
      .substring(0, 15000);

  if (!visibleText) {
      speak("No readable content found on this page.");
      return;
  }

  speak("Processing your summary request. Please wait.");

  // Use proper fetch headers
  fetch('http://localhost:5000/summarize', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ text: visibleText })
  })
  .then(response => {
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
  })
  .then(data => {
      if (data.summary) {
          speak("Here is the summary: " + data.summary);
      } else {
          speak("No summary could be generated.");
      }
  })
  .catch(error => {
      console.error('Summarization error:', error);
      speak("There was an error generating the summary. Please try again.");
  });
}
  // YOUTUBE COMMANDS
  else if (location.hostname.includes("youtube.com")) {
    function getVideo() {
      return document.querySelector("video");
    }

    function waitForVideo(callback) {
      const video = getVideo();
      if (video) callback(video);
      else setTimeout(() => waitForVideo(callback), 500);
    }

    if (command === "play video" || command === "start video") {
      waitForVideo((video) => {
        video.play();
        speak("Video playing");
      });

    } else if (command === "pause video" || command === "stop video") {
      waitForVideo((video) => {
        video.pause();
        speak("Video paused");
      });

    } else if (command === "mute") {
      waitForVideo((video) => {
        video.muted = true;
        speak("Muted");
      });

    } else if (command === "unmute") {
      waitForVideo((video) => {
        video.muted = false;
        speak("Unmuted");
      });

    } else if (command === "volume up") {
      waitForVideo((video) => {
        video.volume = Math.min(1, video.volume + 0.1);
        speak("Volume up");
      });

    } else if (command === "volume down") {
      waitForVideo((video) => {
        video.volume = Math.max(0, video.volume - 0.1);
        speak("Volume down");
      });

    } else if (command === "skip forward") {
      waitForVideo((video) => {
        video.currentTime += 10;
        speak("Skipped forward 10 seconds");
      });

    } else if (command === "rewind") {
      waitForVideo((video) => {
        video.currentTime -= 10;
        speak("Rewinded 10 seconds");
      });

    } else if (command === "read video title") {
      const selectors = [
        'h1.title yt-formatted-string',
        'h1.ytd-watch-metadata',
        'h1',
        'title'
      ];
      let title = selectors.map(sel => document.querySelector(sel)?.innerText).find(Boolean);
      if (!title) title = document.title;
      speak("Title: " + title);

    } else if (command === "read description") {
      const selectors = [
        '#description',
        '#description yt-formatted-string',
        'ytd-expander .content'
      ];
      let desc = selectors.map(sel => document.querySelector(sel)?.innerText).find(Boolean);
      if (desc) speak("Description: " + desc);
      else speak("Description not found.");

    } else if (command === "read comments") {
      const comment = document.querySelector("#comments #content-text")?.innerText;
      if (comment) speak("First comment says: " + comment);
      else speak("No comments found.");

    } else if (command === "next video") {
      const next = document.querySelector(".ytp-next-button, ytd-compact-video-renderer a");
      if (next) next.click();
      else speak("Next video button not found.");

    } else if (command === "previous video") {
      window.history.back();
    }
  }
 // Twitter-specific logic
 else if (location.hostname.includes("twitter.com") || location.hostname.includes("x.com")) {
  const tweetSelector = 'article[role="article"]';

  function getVisibleTweets() {
    return [...document.querySelectorAll(tweetSelector)].filter(el => {
      const bounds = el.getBoundingClientRect();
      return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
    });
  }

  function cleanTweetText(tweetElement) {
    const cloned = tweetElement.cloneNode(true);
    cloned.querySelectorAll('svg, time, [role="button"], [data-testid="caret"]').forEach(el => el.remove());

    const textLines = cloned.innerText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !/^\d+$/.test(line));

    return textLines.join('. ');
  }

  function readTweetByIndex(index) {
    const tweets = getVisibleTweets();
    console.log(`Found ${tweets.length} visible tweets.`);

    if (tweets.length === 0) {
      speak("No visible tweets found.");
      return;
    }

    const tweet = tweets[index];
    if (tweet) {
      const cleanText = cleanTweetText(tweet);
      if (cleanText) {
        speak(`Tweet ${index + 1}: ${cleanText}`);
      } else {
        speak("Tweet found but it has no readable text.");
      }
    } else {
      speak("That tweet number is not available.");
    }
  }

  function clickButtonOnTweet(index, testId, actionName) {
    const tweets = getVisibleTweets();
    const tweet = tweets[index];
    if (!tweet) {
      speak(`Tweet number ${index + 1} is not available.`);
      return;
    }

    const button = tweet.querySelector(`[data-testid="${testId}"]`);
    if (button) {
      button.click();
      speak(`${actionName} tweet number ${index + 1}`);
    } else {
      speak(`Couldn't find the ${actionName.toLowerCase()} button on tweet ${index + 1}`);
    }
  }

  function openTweet(index) {
    const tweets = getVisibleTweets();
    const tweet = tweets[index];
    if (!tweet) {
      speak(`Tweet number ${index + 1} is not available.`);
      return;
    }

    const link = tweet.querySelector('a[href*="/status/"]');
    if (link && link.href) {
      speak(`Opening tweet number ${index + 1}`);
      window.location.href = link.href;
    } else {
      speak("Could not open that tweet.");
    }
  }

  // Voice Command Routing
  const readMatch = command.match(/read tweet number (\d+)/);
  const likeMatch = command.match(/like tweet number (\d+)/);
  const retweetMatch = command.match(/share tweet number (\d+)/);
  const openMatch = command.match(/open tweet number (\d+)/);

  if (command === "read latest tweet" || command === "read first tweet") {
    setTimeout(() => readTweetByIndex(0), 500);

  } else if (readMatch) {
    const index = parseInt(readMatch[1], 10) - 1;
    setTimeout(() => readTweetByIndex(index), 500);

  } else if (likeMatch) {
    const index = parseInt(likeMatch[1], 10) - 1;
    clickButtonOnTweet(index, "like", "Liked");

  } else if (retweetMatch) {
    const index = parseInt(retweetMatch[1], 10) - 1;
    clickButtonOnTweet(index, "retweet", "Retweeted");

  } else if (openMatch) {
    const index = parseInt(openMatch[1], 10) - 1;
    openTweet(index);
  }
}


// Google Search-specific logic
else if (location.hostname.includes("google.com") && location.pathname === "/search") {
  const results = [...document.querySelectorAll("h3")].filter(h => isInViewport(h));

  if (command.includes("read top result") || command.includes("read first result")) {
    if (results.length > 0) {
      speak(results[0].innerText);
    } else {
      speak("No results found.");
    }

  } else if (command.match(/read result number \d+/)) {
    const index = parseInt(command.match(/read result number (\d+)/)[1]) - 1;
    if (results[index]) {
      speak(results[index].innerText);
    } else {
      speak("Result not found.");
    }

  } else if (command.match(/open result number \d+/)) {
    const index = parseInt(command.match(/open result number (\d+)/)[1]) - 1;
    const link = results[index]?.closest("a");
    if (link && link.href) {
      window.location.href = link.href;
    } else {
      speak("Could not open that result.");
    }

  } else if (command.includes("read all results")) {
    if (results.length === 0) {
      speak("No search results found.");
    } else {
      results.slice(0, 5).forEach((res, i) => {
        speak(`${i + 1}: ${res.innerText}`);
      });
    }
  }
}
// Wikipedia-specific logic


 else if (command.match(/read section ['"]?(.+?)['"]?$/)) {
    const sectionMatch = command.match(/read section ['"]?(.+?)['"]?$/);
    const sectionTitle = sectionMatch[1];
    const sectionHeading = [...document.querySelectorAll("h2, h3, h4")]
      .find(h => h.innerText.toLowerCase().includes(sectionTitle.toLowerCase()));

    if (sectionHeading) {
      const paragraphs = [];
      let el = sectionHeading.nextElementSibling;
      while (el && !["H2", "H3", "H4"].includes(el.tagName)) {
        if (el.innerText && el.innerText.trim().length > 0) {
          paragraphs.push(el.innerText);
        }
        el = el.nextElementSibling;
      }
      if (paragraphs.length > 0) {
        paragraphs.slice(0, 3).forEach(p => speak(p));
      } else {
        speak("No content found in that section.");
      }
    } else {
      speak("Section not found.");
    }

  } else if (command.match(/go to section ['"]?(.+?)['"]?$/)) {
    const sectionMatch = command.match(/go to section ['"]?(.+?)['"]?$/);
    const sectionTitle = sectionMatch[1];
    const sectionHeading = [...document.querySelectorAll("h2, h3, h4")]
      .find(h => h.innerText.toLowerCase().includes(sectionTitle.toLowerCase()));

    if (sectionHeading) {
      sectionHeading.scrollIntoView({ behavior: "smooth" });
      speak("Scrolled to section " + sectionTitle);
    } else {
      speak("Section not found.");
    }
  }

  // CATCH-ALL
  else {
    speak("Sorry, I didn't understand that command.");
  }
});
