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

// Replace these with your real credentials from Google Cloud Console
const GOOGLE_CLIENT_ID = "1032445980749-k3b5dis8nf2g6b993909650gps1bj0p8.apps.googleusercontent.com";
const GOOGLE_API_KEY = "AIzaSyCv2E23csjxD8lYNJ-SOyr6B5cgXW9ZGv4";

async function addMeetingToGoogleCalendar(meeting) {
  return new Promise((resolve, reject) => {
    gapi.load("client:auth2", async () => {
      try {
        await gapi.client.init({
          apiKey: GOOGLE_API_KEY,
          clientId: GOOGLE_CLIENT_ID,
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
          ],
          scope: "https://www.googleapis.com/auth/calendar.events",
        });
        
        const authInstance = gapi.auth2.getAuthInstance();
        const user = getUser();
        
        if (!user) {
          reject("User not signed in");
          return;
        }
        
        await authInstance.signIn();
        
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
          resolve("Meeting added to Google Calendar successfully!");
        } else {
          reject("Failed to add event to calendar");
        }
      } catch (error) {
        console.error("Google Calendar Error:", error);
        reject(error);
      }
    });
  });
}

// Helper: Add 30 minutes to a given time string
function add30Minutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes + 30);
  return date.toTimeString().slice(0, 5);
}

// ===================== CONFIRM MEETING (USED IN index.html) =====================
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
    addMessage("❌ Could not connect to Google Calendar. Saved locally instead.", "bot");
  }
}