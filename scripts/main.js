/**
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';



// Shortcuts to DOM Elements.
var messageForm = document.getElementById('message-form');
var leavingForm = document.getElementById('leaving-form');
var contactForm = document.getElementById('contact-form');
var problemForm = document.getElementById('problem-form');
var updateForm = document.getElementById('update-form');
var messageInput = document.getElementById('new-post-message');
var updateInput = document.getElementById('update-post-message');
var contactInfo = document.getElementById('display-contact-info');
var contactInput = document.getElementById('contact-spot-number');

var titleInput = document.getElementById('new-post-title');
var updateInput = document.getElementById('update-post-title');
var signInButton = document.getElementById('sign-in-button');
var signOutButton = document.getElementById('sign-out-button');
var splashPage = document.getElementById('page-splash');
var addPost = document.getElementById('add-post');
var updatePost = document.getElementById('update-post');
var addButton = document.getElementById('add');
var contactButton = document.getElementById('get-contact-info');
var addWhenSpotFull = document.getElementById('add-when-spot-full');
var updateTimeButton = document.getElementById('update-time-form');


var recentPostsSection = document.getElementById('recent-posts-list');
var userPostsSection = document.getElementById('user-posts-list');
var topUserPostsSection = document.getElementById('top-user-posts-list');
var spotSection = document.getElementById('spot-list');


var recentMenuButton = document.getElementById('menu-recent');
var myPostsMenuButton = document.getElementById('menu-my-posts');
var myTopPostsMenuButton = document.getElementById('menu-my-top-posts');
var listeningFirebaseRefs = [];

var userSpotsButton = document.getElementById('menu-my-spots');
var mySpotsList = document.getElementById('spot-list');
var updateTimeForm = document.getElementById('spot-confirm-form');
var spotConfirmPage = document.getElementById('spot-confirm-page');

/**
 * Saves a new parking session to the Firebase DB.
 */
// [START write_fan_out]
function writeNewParkingSession(uid, date, optionalText) {

  var currentTime = getDate();

  var parkingSessionData = {
    uid: uid,
    datestart:date,
    dateend:'',
    optionalText:optionalText,
    sessionStart:currentTime
  };
  var newPostKey = firebase.database().ref().child('sessions').push().key;
  var updates = {};
  updates['/sessions/' + newPostKey] = parkingSessionData;

  //Need to find an open spot now.  
  
  var query = firebase.database().ref('spots').orderByKey();  //Get all the spots that exist.
  query.once('value').then(function(snapshot) {
    snapshot.forEach(function(childSnapshot) {
      // key will be "ada" the first time and "alan" the second time
	var childSpotNumber;
	var childIsOccupied;
	var childDatauid;
	var key;
	var spotUpdate = {};

	key = childSnapshot.key;
	// childData will be the actual contents of the child
	var childData = childSnapshot.val();
	childSpotNumber = childData.spotnumber;
	childIsOccupied = childData.isoccupied;
	childDatauid = childData.uid;
	if (!childIsOccupied) {
	    var aSpotData = {
		uid:uid,
		isoccupied:true,
		spotnumber:childSpotNumber
	    };    
	   spotUpdate['/spots/' + (childSpotNumber + 1000).toString()] = aSpotData;
	   if (childSpotNumber) { //only the end will not have this 
	       var result = firebase.database().ref().update(spotUpdate); 
	   }
	   return true;
	} // condition that I'm not handling, when all are occupied.
	if (childData.end){
	    // I made it to the end of the list and did not find an open spot.  Spots are all full!
	    
	}

    });
  });
  return firebase.database().ref().update(updates);


}
// [END write_fan_out]


/**
 * Starts listening for new posts and populates posts lists.
 */

function startDatabaseQueries() {
  // [START my_top_posts_query]
  
  var myUserId = firebase.auth().currentUser.uid;
  var topUserPostsRef = firebase.database().ref('user-posts/' + myUserId).orderByChild('starCount');
  // [END my_top_posts_query]
  // [START recent_posts_query]
  var recentPostsRef = firebase.database().ref('posts').limitToLast(100);

  // [END recent_posts_query]
  //var userPostsRef = firebase.database().ref('user-posts/' + myUserId);
  var userPostsRef = firebase.database().ref('user-posts');

  var userSpotsRef = firebase.database().ref('spots');  //Get all the spots that exist.
  
  
  var fetchPosts = function(postsRef, sectionElement) {
    postsRef.on('child_added', function(data) {
      var author = data.val().author || 'Anonymous';  //Is this the correct file?
      var containerElement = sectionElement.getElementsByClassName('posts-container')[0];
      containerElement.insertBefore(
          createPostElement(data.key, data.val().title, data.val().body, author, data.val().uid, ""),
          containerElement.firstChild);
    });
    postsRef.on('child_changed', function(data) {	
		var containerElement = sectionElement.getElementsByClassName('posts-container')[0];
		var postElement = containerElement.getElementsByClassName('post-' + data.key)[0];
		postElement.getElementsByClassName('mdl-card__title-text')[0].innerText = data.val().title;
		postElement.getElementsByClassName('username')[0].innerText = data.val().author;
		postElement.getElementsByClassName('text')[0].innerText = data.val().body;
		postElement.getElementsByClassName('star-count')[0].innerText = data.val().starCount;
    });
    postsRef.on('child_removed', function(data) {
		var containerElement = sectionElement.getElementsByClassName('posts-container')[0];
		var post = containerElement.getElementsByClassName('post-' + data.key)[0];
	    post.parentElement.removeChild(post);
    });
  };

  //Here's where we deal with if someone clicks on the parking spot button.
 var fetchSpotPosts = function(postsRef, sectionElement, thePosts) {

   //postRef is the thing back from the database.  Let's find the one with uid
   
   //Now, what spot has this uid?
   
    postsRef.on('child_added', function(data) {
      var myId = firebase.auth().currentUser.uid;
      var dataId = data.val().uid;
      if (dataId == myId) {
	  var author = data.val().spotnumber || 'No spot-number';  //data.val().author || 'Anonymous';  //Is this the correct file?
	  var containerElement = thePosts.getElementsByClassName('posts-container')[0];
	  //containerElement.insertBefore(createPostElementForParkingSpots(data.uid, data.val().spotnumber, data.val().isoccupied, author, data.val().uid, data.val().uid), containerElement.firstChild);
      }
    });

   
	
    //This updates the UI
    postsRef.on('child_changed', function(data) {	
		var containerElement = thePosts.getElementsByClassName('posts-container')[0];
		var postElement = containerElement.getElementsByClassName('post-' + data.key)[0];
		//postElement.getElementsByClassName('mdl-card__title-text')[0].innerText = data.val().title;
		//postElement.getElementsByClassName('username')[0].innerText = data.val().author;
		//postElement.getElementsByClassName('text')[0].innerText = data.val().body;
		//postElement.getElementsByClassName('star-count')[0].innerText = data.val().starCount;
    });
    postsRef.on('child_removed', function(data) {
		var containerElement = sectionElement.getElementsByClassName('posts-container')[0];
		var post = containerElement.getElementsByClassName('post-' + data.key)[0];
	    post.parentElement.removeChild(post);
    });
  };
  
  // Fetching and displaying all posts of each sections.
  fetchPosts(topUserPostsRef, topUserPostsSection);
  // fetchPosts(recentPostsRef, recentPostsSection);
  fetchPosts(userPostsRef, userPostsSection);
//  fetchSpotPosts(userSpotsRef, mySpotsList, topUserPostsSection);
  fetchSpotPosts(userSpotsRef, mySpotsList, mySpotsList);
  

  // Keep track of all Firebase refs we are listening to.
  listeningFirebaseRefs.push(topUserPostsRef);
  listeningFirebaseRefs.push(recentPostsRef);
  listeningFirebaseRefs.push(userPostsRef);
  listeningFirebaseRefs.push(userSpotsRef);
}

/**
 * Writes the user's data to the database.
 */
// [START basic_write]

function writeUserData(userId, name, email, imageUrl) {
  firebase.database().ref('users/' + userId).set({
    username: name,
    email: email,
    profile_picture : imageUrl
  });
}
// [END basic_write]

/**
 * Cleanups the UI and removes all Firebase listeners.
 */
function cleanupUi() {
  //Legacy of sample code.  I probably don't need this.

  // Remove all previously displayed posts.
  //topUserPostsSection.getElementsByClassName('posts-container')[0].innerHTML = '';
  //recentPostsSection.getElementsByClassName('posts-container')[0].innerHTML = '';
  //userPostsSection.getElementsByClassName('posts-container')[0].innerHTML = '';

  // Stop all currently listening Firebase listeners.
  listeningFirebaseRefs.forEach(function(ref) {
    ref.off();
  });
  listeningFirebaseRefs = [];
}


/**
 * The ID of the currently signed-in User. We keep track of this to detect Auth state change events that are just
 * programmatic token refresh but not a User status change.
 */
var currentUID;

/**
 * Triggers every time there is a change in the Firebase auth state (i.e. user signed-in or user signed out).
 */
function onAuthStateChanged(user) {
  // We ignore token refresh events.
  if (user && currentUID === user.uid) {
    return;
  }

  cleanupUi();
  if (user) {
    currentUID = user.uid;
    splashPage.style.display = 'none';
    writeUserData(user.uid, user.displayName, user.email, user.photoURL);
    startDatabaseQueries();
  } else {
    // Set currentUID to null.
    currentUID = null;
    // Display the splash page where you can sign-in.
    splashPage.style.display = '';
  }
}





/**
 * Creates a new parking session for the current user.
 */
function newParkingSessionForCurrentUser(date, optionalText) {
  // [START single_value_read]
  var userId = firebase.auth().currentUser.uid;
  return firebase.database().ref('/sessions/' + userId).once('value').then(function(snapshot) {
   // var username = snapshot.val().username;
    // [START_EXCLUDE]
    return writeNewParkingSession(firebase.auth().currentUser.uid, date, optionalText);
    // [END_EXCLUDE]
  });
  // [END single_value_read]
}

function getDate() {
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth()+1; //January is 0!
    var yyyy = today.getFullYear();

    if(dd<10) {
	dd='0'+dd
    } 

    if(mm<10) {
	mm='0'+mm
    } 

    today = mm+'/'+dd+'/'+yyyy;


    var d = new Date();
    var n = d.toLocaleTimeString();
    
    return today + ':' + n;;
}


function getUserInfo() {
}


function checkOutCurrentUser() {  
  var returnThing;
  var sessionsRef = firebase.database().ref('sessions').orderByKey();
    sessionsRef.once('value').then(function(eachsession) {
	eachsession.forEach(function(theSession){
	    var userId = firebase.auth().currentUser.uid;
	    if(theSession.val().uid == userId && !theSession.val().sessionEnd) {
		//Update the field so dateend = now.
		var parkingSessionData = {
		    uid: theSession.val().uid,
		    datestart:theSession.val().datestart,
		    sessionEnd:getDate() , //now
		    sessionStart:theSession.val().sessionStart,
		    optionalText:theSession.val().optionalText
		};    
		var theKey = theSession.key;
		var updates = {};
		updates['/sessions/' + theKey] = parkingSessionData;
		return firebase.database().ref().update(updates);      		
	    }
	});
    });


		
    //Anything here when the remove is successful
    //Update the parking spot to remove the uid and isoccupied.

    var query = firebase.database().ref('spots').orderByKey();  //Get all the spots that exist.
    query.once('value').then(function(snapshot) {
	snapshot.forEach(function(childSnapshot) {
	    // key will be "ada" the first time and "alan" the second time
	    var curUserId = firebase.auth().currentUser.uid;
	    var childSpotNumber;
	    var childIsOccupied;
	    var childDatauid;
	    var key;
	    var spotUpdate = {};
	    key = childSnapshot.key;
	    // childData will be the actual contents of the child
	    var childData = childSnapshot.val();
	    childSpotNumber = childData.spotnumber;
	    childIsOccupied = childData.isoccupied;
	    childDatauid = childData.uid;
	    if (curUserId == childDatauid ) {
		var aSpotData = {
		    uid:'',
		    isoccupied:false,
		    spotnumber:childSpotNumber
		};    	   
		spotUpdate['/spots/' + (childSpotNumber + 1000).toString()] = aSpotData;
		return firebase.database().ref().update(spotUpdate); 
	    }
	});
		   
    });
}
				   

/**
 * Displays the given section element and changes styling of the given button.
 */
function showSection(sectionElement, buttonElement) {
  recentPostsSection.style.display = 'none';
  userPostsSection.style.display = 'none';
  topUserPostsSection.style.display = 'none';
  spotSection.style.display = 'none';  
  addPost.style.display = 'none';
  //addWhenSpotFull.style.display='none';
  contactButton.style.display='none';
  contactInfo.style.display='none'; 
  updatePost.style.display = 'none'; 
  spotConfirmPage.style.display = 'none';
 
  //addPostWhenSpotFull
 
  recentMenuButton.classList.remove('is-active');
  myPostsMenuButton.classList.remove('is-active');
  myTopPostsMenuButton.classList.remove('is-active');
  //userSpotsButton.classList.remove('is-active'); 

  if (sectionElement) {
    sectionElement.style.display = 'block';
  }
  if (buttonElement) {
    buttonElement.classList.add('is-active');
  }
}

// Bindings on load.
window.addEventListener('load', function() {
  // Bind Sign in button.
  signInButton.addEventListener('click', function() {
    var provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);
  });

  // Bind Sign out button.
  signOutButton.addEventListener('click', function() {
    firebase.auth().signOut();
  });

  // Listen for auth state changes
  firebase.auth().onAuthStateChanged(onAuthStateChanged);


  // Saves message on form submit.
  // This is where the assign me a spot starts.
  messageForm.onsubmit = function(e) {
    e.preventDefault();
    var date = messageInput.value;
    var optionalText = titleInput.value;

    if (optionalText) {
        newParkingSessionForCurrentUser(optionalText, date).then(function(){
        //myPostsMenuButton.click();
	showPark(1);
	   
      });
      messageInput.value = '';
      titleInput.value = '';
    }
      showPark(1);
      
  };


  updateTimeButton.onsubmit = function(y) {
      y.preventDefault();
      showSection(updatePost);
  }


    problemForm.onsubmit = function(u){
	u.preventDefault();
	Promise.resolve().then(getNewSpot).then(showPark(1));
        //getNewSpot().then(function(){
 	//showPark(1);	   
      //});
      //showPark(1);
    };




  // Update the planned departure time.
  updateForm.onsubmit = function(w){
      w.preventDefault();
      var xm = 'am';
      var date = updateInput.value;
      
      if (date > 12) { 
	  date = date - 12
	  xm = 'pm';
      };
      var optionalText = updatePost.value;
      // do the update here.
      updateDeparture(date);

      confirmWithMessage('Spot update confirmed', 'Your are now set to leave at: ' + date + ':00 '+ xm);
  
  };


   //Here's where someone says that he/she is leaving.
    leavingForm.onsubmit = function(f) {
	f.preventDefault();
	Promise.resolve().then(checkOutCurrentUser).then(showPark(2));
	//checkOutCurrentUser().then(function() { 
	//    showPark();	
	//});
    };

  //Here's where someone asks for a user in a certain spot
    contactForm.onsubmit = function(g) {
	g.preventDefault();

	var spotToCheck = 1000 + Number(contactInput.value);
	var userInSpot = firebase.database().ref('spots/' + spotToCheck);
	userInSpot.once('value').then(function(theSpot) {
	    if (theSpot.val()) {
		var userId = theSpot.val().uid;
		if (userId) {
		    //var userId = firebase.auth().currentUser.uid;
		    var userData = firebase.database().ref('users/' + userId);
		    userData.once('value').then(function(userData) {
			updateContactDisplay(userData.val().email, userData.val().profile_picture, userData.val().username, "", "");


		});
	
    } else {
	updateContactDisplay("", "", "", "Spot is empty", "");
    }

  }else { 
	updateContactDisplay("", "", "", "Spot number does not exist.", "");

      }
  }) ;
 }


    //showPark();
    //  addWhenSpotFull.style.display='none';
     // recentMenuButton.click();
      //messageInput.value = '';
      //titleInput.value = '';
   //showSection(addPost);
   //showPark();
    
 //};


  // Bind menu buttons.
  recentMenuButton.onclick = function() {
  //  showSection(recentPostsSection, recentMenuButton);
  //    showSection(contactButton);
        showPark();
  };
  myPostsMenuButton.onclick = function() {
    //showSection(userPostsSection, myPostsMenuButton);
    //show the contact form
     showSection(contactButton)
     //showPark();
  };

  myTopPostsMenuButton.onclick = function() {
      // Start the about section
      // showSection(topUserPostsSection, myTopPostsMenuButton);
      updateContactDisplay("", "", "", "", "Noah Kindler");
 };




}, false);



function showPark(confirmation) {
    var allSpotsFull = false;
    var openSpot = false;
    var userSpotNumber;
    var alreadyParked = false;
      var query = firebase.database().ref('spots').orderByKey();  //Get all the spots that exist.
      query.once('value').then(function(spotsList) {
	  spotsList.forEach(function(spot) {
	var childSpotNumber;
	var childIsOccupied;
	var childDatauid;
	var uid = firebase.auth().currentUser.uid;
	var spotData = spot.val();
	childDatauid = spotData.uid;
        if (childDatauid && uid == childDatauid){
	    alreadyParked = true;
            userSpotNumber = spotData.spotnumber;
	    return true;  //just added this.
	}
        if (!spotData.isoccupied && spotData.spotnumber){
	    openSpot = true;
	}
  
	if (spotData.end && !openSpot){
	    allSpotsFull = true;
	}
     });  
  if (allSpotsFull) {
	showSection(contactInfo);
        updateContactDisplay("", "", "", "All spots are full!", "");
  } else if (/*There's a spot with the uid already */ !alreadyParked) { 
      showSection(addPost);
      messageInput.value = '';
      titleInput.value = '';
    } else if (confirmation == 1) {
	// We show the confirmation page, instead of the verification
	//updateContactDisplay("You have been assigned spot " + userSpotNumber + ".  Please proceed to it, and remember to check out of it when you leave.", "", "", 'Park in spot ' + userSpotNumber, '') 
	confirmWithMessage("You have been assigned spot " + userSpotNumber,  "Please proceed to it, and remember to check out of it when you leave.");
      } else if (confirmation == 2){
	updateContactDisplay("Thank you for using ParkUP.  You are checked out and your spot is free.", "", "", 'You have checked out', '') 
      }	 else  {
      showSection(addWhenSpotFull);      
	// var div = document.getElementById('spotnumber');
	// div.innerHTML = 'You are currently parked in spot: ' + userSpotNumber;	
	  confirmWithMessage("Your are currently parked in spot " + userSpotNumber, "");
	messageInput.value = '';
	titleInput.value = '';
    }

   });
  }


function updateContactDisplay(email, profile_picture, username, warning, about){
    showSection(contactInfo);

    var divEmail= document.getElementById('email');    
    if (email && !warning) {
	divEmail.innerHTML = 'Email: ' + email;
    } else if (warning) {
	divEmail.innerHTML = email;
    } else if (about) {
	//it's the about
	divEmail.innerHTML='Created in California.  <p> For more information, contact Noah Kindler</p><p> nkindler@gmail.com</p>';
    }

    
    var divUserName = document.getElementById('username');
    if (username) {
	divUserName.innerHTML = 'Username: ' + username;
    } else if (warning) {
	divUserName.innerHTML = warning;
    } else if (about) {
	divUserName.innerHTML='ParkUp app';
    }

    var divProfilePic = document.getElementById('profile_picture');
    if (profile_picture) {
	divProfilePic.innerHTML = '<img src=\'' + profile_picture + '\'>';
    } else {
	divProfilePic.innerHTML = "";
    }
}


function updateSimpleMessage(title, message){
    showSection(contactInfo);

    var divUserName= document.getElementById('username');    
	divUserName.innerHTML = title;
    
    var divEmail = document.getElementById('email');
	divEmail.innerHTML = message;
}

function confirmWithMessage(title, message) {
    showSection(spotConfirmPage);

    var divUserName= document.getElementById('heading');    
	divUserName.innerHTML = title;
    
    var divEmail = document.getElementById('inner-message');
	divEmail.innerHTML = message;

    //spotConfirmPage.style.display='is-active';

}

function updateDeparture(date) {
    //go through the sessions and find a uid and an undefined sessionEnd.
    var sessionsRef = firebase.database().ref('sessions').orderByKey();
    sessionsRef.once('value').then(function(eachsession) {
	eachsession.forEach(function(theSession){
	    var userId = firebase.auth().currentUser.uid;
	    if(theSession.val().uid == userId && !theSession.val().sessionEnd) {
		// This is the current session.
		var parkingSessionData = {
		    uid: theSession.val().uid,
		    datestart:date,
		    //sessionEnd:getDate() , //now
		    sessionStart:theSession.val().sessionStart,
		    optionalText:theSession.val().optionalText
		};    
		var theKey = theSession.key;
		var updates = {};
		updates['/sessions/' + theKey] = parkingSessionData;
		return firebase.database().ref().update(updates);      		
	    }
	});
    });
}

function getNewSpot(callback) {
  
    var uid = firebase.auth().currentUser.uid;
    var currentTime = getDate();

    /*
  var parkingSessionData = {
    uid: uid,
    datestart:date,
    dateend:'',
    optionalText:"",
    sessionStart:currentTime
  };
  var newPostKey = firebase.database().ref().child('sessions').push().key;
  var updates = {};
  updates['/sessions/' + newPostKey] = parkingSessionData;
  */
  //Need to find an open spot now.  
  var newSpot = false;
  var theSpots = firebase.database().ref('spots').orderByKey();  
  theSpots.once('value').then(function(aSpot) {
    aSpot.forEach(function(spotData) {
	var childSpotNumber;
	var childIsOccupied;
	var childDatauid;
	var key;
	var spotUpdate = {};

	key = spotData.key;
	// spotData will be the actual contents of the spot
	var childData = spotData.val();
	childSpotNumber = childData.spotnumber;
	childIsOccupied = childData.isoccupied;
	childDatauid = childData.uid;
	if (!childIsOccupied && !newSpot) {
	    var aSpotData = {
		uid:uid,
		isoccupied:true,
		spotnumber:childSpotNumber
	    };    
	    newSpot = true;
	    spotUpdate['/spots/' + (childSpotNumber + 1000).toString()] = aSpotData;
	    if (childSpotNumber) { //only the end will not have this 
		var result = firebase.database().ref().update(spotUpdate);
		//callback();
		
	    }
	
	} 
	if (childDatauid == uid ) {
	    // Free the spot.
	    var freeSpotData = {
		uid:"",
		isoccupied:false,
		spotnumber:childSpotNumber
	    };
	    spotUpdate['/spots/' + (childSpotNumber + 1000).toString()] = freeSpotData;
	    firebase.database().ref().update(spotUpdate); 
	    //callback();
	}

	// condition that I'm not handling, when all are occupied.
	if (childData.end){
	    // I made it to the end of the list and did not find an open spot.  Spots are all full!
	    showPark(1);
	}

    });
  });
  //return firebase.database().ref().update(updates);

    callback();
}


function clearAllSpots(){
    //var day =new Date().getDay();
    var hours =new Date().getHours();
    if (hours > 0 && hours < 2)  {  // At 1am++something, all slots are cleared.
                                         
	//What you want to do daily goes here
	var theSpots = firebase.database().ref('spots').orderByKey();  
	theSpots.once('value').then(function(aSpot) {
	    aSpot.forEach(function(spotData) {
		var childSpotNumber;
		var childIsOccupied;
		var childDatauid;
		var key;
		var spotUpdate = {};
		key = spotData.key;
		// spotData will be the actual contents of the spot
		var childData = spotData.val();
		childSpotNumber = childData.spotnumber;
		childIsOccupied = childData.isoccupied;
		childDatauid = childData.uid;
		if (childIsOccupied) {
		    var aSpotData = {
			uid:"",
			isoccupied:false,
			spotnumber:childSpotNumber
		    };    
		    spotUpdate['/spots/' + (childSpotNumber + 1000).toString()] = aSpotData;
		    if (childSpotNumber) { //only the end will not have this 
			var result = firebase.database().ref().update(spotUpdate);
			
		    }
	
		}
 
	    }
			  
			 )
	});

	//I need to delete the sessions here, but lets see if this works
	var sessionsRef = firebase.database().ref('sessions').orderByKey();
	sessionsRef.once('value').then(function(eachsession) {
	    eachsession.forEach(function(theSession){
		if(!theSession.val().sessionEnd) {
		    //Update the field so dateend = now.
		    var parkingSessionData = {
			uid: theSession.val().uid,
			datestart:theSession.val().datestart,
			sessionEnd:getDate() , //now
			sessionStart:theSession.val().sessionStart,
			optionalText:theSession.val().optionalText
		    };    
		    var theKey = theSession.key;
		    var updates = {};
		    updates['/sessions/' + theKey] = parkingSessionData;
		    firebase.database().ref().update(updates);      		
		}
	    });
	});
	// end the if the hour is correct hour (in this case 1am)
    }
}

var basicSchedule = {h: [15], m: [20]};
//var textSched = later.parse.text('at 3:15pm everyday');
later.date.localTime();
setInterval(clearAllSpots, 3600000); // one hour check.
