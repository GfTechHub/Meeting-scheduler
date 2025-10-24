// ===================== GOOGLE SIGN-IN HANDLER =====================
function handleCredentialResponse(response) {
  const data = parseJwt(response.credential);
  
  // Save user info
  localStorage.setItem("userName", data.name);
  localStorage.setItem("userEmail", data.email);
  localStorage.setItem("userPicture", data.picture);
  
  // Redirect to profile after successful login
  window.location.href = "profile.html";
}

// Decode Google ID token
function parseJwt(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
    .split("")
    .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
    .join("")
  );
  return JSON.parse(jsonPayload);
}

// Check if user is logged in
function getUser() {
  const name = localStorage.getItem("userName");
  const email = localStorage.getItem("userEmail");
  const picture = localStorage.getItem("userPicture");
  if (name && email) {
    return { name, email, picture };
  }
  return null;
}

// Logout
function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

// ===================== MEETING STORAGE =====================
function saveMeeting(meeting) {
  let meetings = JSON.parse(localStorage.getItem("meetings") || "[]");
  meetings.push(meeting);
  localStorage.setItem("meetings", JSON.stringify(meetings));
}

function getMeetings() {
  return JSON.parse(localStorage.getItem("meetings") || "[]");
}

// ===================== GOOGLE CALENDAR INTEGRATION =====================
const GOOGLE_CLIENT_ID = "1032445980749-k3b5dis8nf2g6b993909650gps1bj0p8.apps.googleusercontent.com";
const GOOGLE_API_KEY = "AIzaSyCv2E23csjxD8lYNJ-SOyr6B5cgXW9ZGv4";

async function initGoogleAPI(scopes = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.readonly") {
  return new Promise((resolve, reject) => {
    gapi.load("client:auth2", async () => {
      try {
        await gapi.client.init({
          apiKey: GOOGLE_API_KEY,
          clientId: GOOGLE_CLIENT_ID,
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
          scope: scopes,
        });
        resolve(gapi.auth2.getAuthInstance());
      } catch (error) {
        reject(error);
      }
    });
  });
}

// ===================== ADD MEETING TO GOOGLE CALENDAR =====================
async function addMeetingToGoogleCalendar(meeting) {
  try {
    const authInstance = await initGoogleAPI();
    await authInstance.signIn();
    
    const user = getUser();
    if (!user) throw new Error("User not signed in");
    
    const startDateTime = `${meeting.date}T${meeting.time}:00`;
    const endDateTime = `${meeting.date}T${add30Minutes(meeting.time)}:00`;
    
    const event = {
      summary: meeting.purpose || "Scheduled Meeting",
      description: `Meeting scheduled via Meeting Scheduler for ${user.name}`,
      start: { dateTime: startDateTime, timeZone: "Africa/Lagos" },
      end: { dateTime: endDateTime, timeZone: "Africa/Lagos" },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 10 },
          { method: "email", minutes: 30 },
        ],
      },
    };
    
    const response = await gapi.client.calendar.events.insert({
      calendarId: "primary",
      resource: event,
    });
    
    if (response.result && response.result.id) {
      return "✅ Meeting added to Google Calendar successfully!";
    } else {
      throw new Error("Failed to add event to calendar");
    }
  } catch (error) {
    console.error("Google Calendar Error:", error);
    throw error;
  }
}

// ===================== FETCH MEETINGS FROM GOOGLE CALENDAR =====================
async function fetchGoogleCalendarMeetings() {
  try {
    const authInstance = await initGoogleAPI("https://www.googleapis.com/auth/calendar.readonly");
    await authInstance.signIn();
    
    const response = await gapi.client.calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    });
    
    return response.result.items || [];
  } catch (error) {
    console.error("Fetch Calendar Events Error:", error);
    return [];
  }
}

// ===================== CONFIRM MEETING =====================
async function confirmMeeting() {
  const user = getUser();
  if (!user) {
    addMessage("⚠️ Please sign in from your profile first before saving meetings.", "bot");
    return;
  }
  
  saveMeeting(meetingData);
  addMessage("⏳ Adding your meeting to Google Calendar...", "bot");
  
  try {
    const result = await addMeetingToGoogleCalendar(meetingData);
    addMessage("🎉 " + result, "bot");
  } catch (error) {
    addMessage("❌ Could not connect to Google Calendar. Meeting saved locally instead.", "bot");
  }
}

// ===================== HELPER FUNCTIONS =====================
function add30Minutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes + 30);
  return date.toTimeString().slice(0, 5);
}

// ===================== PROFILE PAGE LOADER =====================
async function loadAllMeetings() {
  const container = document.querySelector(".meetings-container");
  if (!container) return;
  
  // 1. Load local meetings first
  const localMeetings = getMeetings();
  if (localMeetings.length > 0) {
    container.innerHTML = localMeetings
      .map(
        (m) => `
      <div class="meeting-card local">
        <strong>${m.purpose || "Local Meeting"}</strong><br>
        📅 ${m.date} ⏰ ${m.time}
      </div>`
      )
      .join("");
  } else {
    container.innerHTML = "<p>Loading meetings...</p>";
  }
  
  // 2. Then load Google Calendar meetings
  const googleMeetings = await fetchGoogleCalendarMeetings();
  if (googleMeetings.length > 0) {
    const googleHTML = googleMeetings
      .map(
        (event) => `
      <div class="meeting-card google">
        <strong>${event.summary || "Untitled Event"}</strong><br>
        ${new Date(event.start.dateTime || event.start.date).toLocaleString()}
      </div>`
      )
      .join("");
    
    container.innerHTML += `<h5 class="mt-3">Google Calendar Events</h5>${googleHTML}`;
  } else if (localMeetings.length === 0) {
    container.innerHTML = "<p>No upcoming meetings found.</p>";
  }
}

// Auto-load meetings if on profile page
window.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.includes("profile.html")) {
    loadAllMeetings();
  }
});