import {ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {TicketService} from './service/ticket.service';
import {LogService} from './service/logging.service';
import {DragAndDropComponent} from './drag-and-drop/drag-and-drop.component';
import {Ticket} from "./entities/ticket.dto";
import {MatDialog} from '@angular/material/dialog';
import {RequestTypeDialogComponent} from './request-type-dialog/request-type-dialog.component';
import {LoginDialogComponent} from './login-dialog/login-dialog.component';
import {SignupDialogComponent} from './signup-dialog/signup-dialog.component';
import {EditDialogComponent} from './edit-dialog/edit-dialog.component';
import {jwtDecode} from "jwt-decode";
import {HttpClient} from '@angular/common/http';
import {AuthService} from './service/auth.service';
import {WrappedTicket} from "./entities/wrappedTicket.dto";
import {checkEmailAddress} from "./service/checkemail.service";
import {SessionExpiredDialogComponent} from './session-expired-dialog/session-expired-dialog.component';
import {LogoutDialogComponent} from './logout-dialog/logout-dialog.component';

interface ChatMessage {
  messageContent: string;
  isUser: boolean;
  wrappedTicket: WrappedTicket | null;
  files: any[];
}

class FileWithProgress {
  file: File;
  progress: number;

  constructor(file: File) {
    this.file = file;
    this.progress = 0;
  }
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title: string = "TalkTix";
  chatInput: string = "";
  emailInput: string = "";
  messageAfterTicketSubmission = ""
  chatMessages: ChatMessage[] = [
    {
      messageContent: "Hi there! Enter your concern and I will create a ticket for you.",
      isUser: false,
      wrappedTicket: null,
      files: []
    }
  ];
  files: any[] = [];
  accountName: string = "";
  waitingServerResponse: boolean = false;
  recognition: any;
  errorMessage: string = '';
  recordingState: 'idle' | 'recording' = 'idle';
  recognitionTimeout: any;
  selectedRequestType: string = '';
  createdTicket: Ticket | undefined;
  isLoggedIn: boolean = false;
  accessToken: string | null = '';

  @ViewChild("fileDropRef", {static: true}) fileDropEl!: ElementRef;
  @ViewChild(DragAndDropComponent) dragAndDropComponent!: DragAndDropComponent;

  constructor(
    private ticketService: TicketService,
    private logger: LogService,
    private changeDetector: ChangeDetectorRef,
    private dialog: MatDialog,
    private http: HttpClient,
    private authService: AuthService,
  ) {
  }

  ngOnInit() {
    const accessToken = localStorage.getItem("access_token") || null;

    if (accessToken) {
      this.authService.checkTokenValidity().subscribe(isValid => {
        if (!isValid) {
          localStorage.removeItem("access_token");
          this.isLoggedIn = false;
          return;
        }
        this.accessToken = localStorage.getItem("access_token") || '';
        this.isLoggedIn = true;
        let email = jwtDecode(this.accessToken).sub;
        this.emailInput = email || '';
        this.authService.getuserinfo(this.emailInput).subscribe(response => {
          this.accountName = response.first_name ?
            response.first_name + " " + response.family_name :
            this.emailInput.substring(0, this.emailInput.indexOf("@"))
        })
      });
    } else {
      this.logger.log('No token found, user is not logged in.');
    }
  }

  setMessageAfterticketSubmission(message: string) {
    this.chatMessages.push({
      messageContent: message,
      isUser: false,
      wrappedTicket: null,
      files: []
    });
  }

  getFiles(event: any) {
    this.files = event;
  }

  formatBytes(bytes: any, decimals = 2) {
    if (bytes === 0) {
      return "0 Bytes";
    }
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  clearFiles() {
    this.dragAndDropComponent.clearFiles();
    this.files = [];
  }

  openLoginDialog() {
    const dialogRef = this.dialog.open(LoginDialogComponent);
    dialogRef.afterClosed().subscribe(result => {
      if (result?.loginSuccess) {
        // logic after closing dialog
        this.emailInput = result.email;
        this.authService.getuserinfo(this.emailInput).subscribe(response => {
          this.accountName = response.first_name ?
            response.first_name + " " + response.family_name :
            this.emailInput.substring(0, this.emailInput.indexOf("@"))
        })
        this.isLoggedIn = true;
        this.chatMessages.push({
          messageContent: "You have successfully logged in.",
          isUser: false,
          wrappedTicket: null,
          files: this.files
        });
      }
    });
  }

  openSignupDialog() {
    const dialogRef = this.dialog.open(SignupDialogComponent);

    dialogRef.afterClosed().subscribe(result => {
      if (result?.signupSuccess) {
        this.emailInput = result.email;
        this.isLoggedIn = true;
        this.chatMessages.push({
          messageContent: "You have successfully signed up and logged in.",
          isUser: false,
          wrappedTicket: null,
          files: this.files
        });
      }
    });
  }

  openEditDialog() {
    const dialogRef = this.dialog.open(EditDialogComponent);
    this.authService.getuserinfo(this.emailInput).subscribe(
      response => {
        dialogRef.componentInstance.first_name = response.first_name;
        dialogRef.componentInstance.family_name = response.family_name;
        dialogRef.componentInstance.location = response.location;
      },
      error => {
        this.errorMessage = 'User not found.';
      });
    dialogRef.componentInstance.old_email = this.emailInput;
    dialogRef.componentInstance.email = this.emailInput;

    dialogRef.afterClosed().subscribe(result => {
      if (result?.editSuccess) {
        this.logout();
        this.authService.login(result.email, result.password).subscribe(
          response => {
            this.isLoggedIn = true;
            this.emailInput = result.email;
          },
          error => {
            this.errorMessage = 'An error occurred during login.';
          }
        );
        this.chatMessages.push({
          messageContent: "You have successfully edited your data!",
          isUser: false,
          wrappedTicket: null,
          files: this.files
        });
      }
    });
  }

  chooseRequestType() {
    const dialogRef = this.dialog.open(RequestTypeDialogComponent);
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.selectedRequestType = result;
        // @ts-ignore
        this.createdTicket.requestType = this.selectedRequestType;
        // @ts-ignore
        this.updateTicketAttributes(this.createdTicket);
        // Handle the selected request type
      }
    });
  }

  updateTicketAttributes(updatedTicket: Ticket) {
    const wrappedTicket: WrappedTicket = {email: this.emailInput, ticket: updatedTicket}

    this.ticketService.updateTicket(wrappedTicket, wrappedTicket.ticket!.id).subscribe((ticket) => {
      this.logger.log("Ticket update was done successfully: " + ticket);

      const existingMessageIndex = this.chatMessages.findIndex(msg => msg.messageContent.includes(ticket.id));

      if (ticket.requestType && ticket.requestType.trim() !== '') {
        const messageText = JSON.stringify(ticket);

        if (existingMessageIndex !== -1) {
          // Send attachments if they exist
          if (this.files.length !== 0) {
            this.sendAttachmentsToServer(ticket);
          }
          this.chatMessages[existingMessageIndex] = {
            messageContent: messageText,
            isUser: false,
            wrappedTicket: null,
            files: []
          };
        } else {
          if (this.files.length !== 0) {
            this.sendAttachmentsToServer(ticket);
          } else {
            this.chatMessages.push({messageContent: messageText, isUser: false, wrappedTicket: null, files: []});
          }
        }

      } else {
        this.logger.log('RequestType is empty. Skipping display in UI.');
      }
    });
  }

  sendAttachmentsToServer(response: any) {
    this.ticketService.sendFiles(this.files, response.id).subscribe(
      (attachmentsResponse: any) => {
        this.chatMessages.push(
          {
            messageContent: "Your ticket has been created successfully! " +
              "Take a look if the printed information accurately captures your concerns. " +
              "If you are happy with the details, use the \"Submit\" button to submit it. " +
              "Otherwise you can edit your ticket directly by clicking on the corresponding fields " +
              "and confirm your changes by pressing the \"Submit\" button. " +
              "In case you want to start again or the ticket is no longer required, " +
              "you can end the process with the \"Cancel\" button.",
            isUser: false,
            wrappedTicket: null,
            files: []
          }
        )
        this.chatMessages.push({
          messageContent: '',
          isUser: false,
          wrappedTicket: {email: this.emailInput, ticket: this.createdTicket},
          files: []
        });
        this.clearFiles();

        this.logger.log('Attachments were sent successfully: ' + attachmentsResponse);
        this.waitingServerResponse = false;
      },
      (error: any) => {
        this.handleError('Unfortunately an error has occurred. Please try again or try again later, we apologize.');
      }
    );
  }

  handleSend(value: string, emailInput: string) {
    const accessToken = localStorage.getItem("access_token") || null;

    if (accessToken) {
      this.authService.checkTokenValidity().subscribe(isValid => {
        if (!isValid) {
          this.expiredlogout();
          return;
        }
        this.accessToken = accessToken;
        this.isLoggedIn = true;
        let email = jwtDecode(this.accessToken).sub;
        this.emailInput = email || '';
        this.processMessage(value, emailInput);
      });
    } else {
      this.logger.log('No token found, user is not logged in.');
      this.processMessage(value, emailInput);
    }
  }

  processMessage(value: string, emailInput: string) {
    this.errorMessage = "";

    if (!value) {
      this.errorMessage = 'Please write a message or leave a voice message.';
      return;
    }

    if (!checkEmailAddress(emailInput)) {
      this.errorMessage = 'Please use a valid email address.';
      return;
    }

    this.chatMessages.push({messageContent: value, isUser: true, wrappedTicket: null, files: this.files});
    this.logger.log('Trying to send message to backend server: ' + value);

    this.ticketService.send(value, emailInput).subscribe(
      (response: any) => {
        let messageText = '';

        if (typeof response === 'object') {
          messageText = JSON.stringify(response);
        } else {
          messageText = response;
        }

        this.changeDetector.detectChanges();

        this.createdTicket = new Ticket(response);

        if (response && (!response.requestType || response.requestType.trim() === '')) {
          this.logger.log('RequestType missing. Choosing.');
          this.chooseRequestType();
          this.logger.log('RequestType updated.');
        } else {
          this.logger.log('RequestType exists.');
        }

        if (response.requestType) {
          // Only handle the response if requestType is present
          if (this.files.length !== 0) {
            this.sendAttachmentsToServer(response);
          } else {
            this.chatMessages.push(
              {
                messageContent: "Your ticket has been created successfully! " +
                  "Take a look if the printed information accurately captures your concerns. " +
                  "If you are happy with the details, use the \"Submit\" button to submit it. " +
                  "Otherwise you can edit your ticket directly by clicking on the corresponding fields " +
                  "and confirm your changes by pressing the \"Submit\" button. " +
                  "In case you want to start again or the ticket is no longer required, " +
                  "you can end the process with the \"Cancel\" button.",
                isUser: false,
                wrappedTicket: null,
                files: []
              }
            )
            this.chatMessages.push({
              messageContent: '',
              isUser: false,
              wrappedTicket: {email: emailInput, ticket: this.createdTicket},
              files: []
            });
          }
        } else {
          // RequestType is empty, do not display the response
          this.logger.log('RequestType is empty. Not displaying the response.');
        }

        this.logger.log('Received response from backend server: ' + response);
        this.waitingServerResponse = false;
      },
      (error) => {
        this.handleError('Unfortunately an error has occurred. Please try again or try again later, we apologize.');
        if (error.status === 401) {
          this.logout();
        }
      }
    );

    this.chatInput = "";
    this.waitingServerResponse = true;
  }

  clearChatHistory() {
    this.chatMessages = [{
      messageContent: "Hi there! Enter your concern and I will create a ticket for you.",
      isUser: false,
      wrappedTicket: null,
      files: []
    }];
  }

  showSessionExpiredDialog() {
    const dialogRef = this.dialog.open(SessionExpiredDialogComponent);

    dialogRef.afterClosed().subscribe(result => {
      this.clearChatHistory();

      console.log('The dialog was closed');
    });
  }

  showLogoutDialog() {
    const dialogRef = this.dialog.open(LogoutDialogComponent);

    dialogRef.afterClosed().subscribe(result => {
      this.clearChatHistory();

      console.log('The dialog was closed');
    });
  }

  startSpeechRecognition() {
    if (this.recordingState === 'idle') {
      this.startRecording();
    } else {
      this.stopRecording();
    }
  }

  startRecording() {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      this.recognition = new ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)();
      this.recognition.lang = 'en-EN';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
      this.recognition.continuous = true;

      this.recognition.start();

      this.recognition.onresult = (event: any) => {
        this.chatInput = "";
        for (let i = 0; i < event.results.length; i++) {
          this.chatInput += event.results[i][0].transcript;
        }
        this.resetRecognitionTimeout();
      };

      this.recognition.onerror = (event: any) => {
        this.handleError('Unfortunately an error has occurred. Please try again or try again later, we apologize.');
      };

      this.recordingState = 'recording';
      this.setRecognitionTimeout();
    } else {
      this.handleError('Speech Recognition API is not supported in this browser. Try using Chrome or Edge');
    }
  }

  stopRecording() {
    this.recognition.stop();
    clearTimeout(this.recognitionTimeout);
    this.recordingState = 'idle';
  }

  setRecognitionTimeout() {
    this.recognitionTimeout = setTimeout(() => {
      if (this.recordingState === 'recording') {
        this.stopRecording();
        this.handleError('Voice input stopped due to inactivity.');
      }
    }, 30000);
  }

  resetRecognitionTimeout() {
    clearTimeout(this.recognitionTimeout);
    if (this.recordingState === 'recording') {
      this.setRecognitionTimeout();
    }
  }

  handleError(errorMessage: string) {
    this.errorMessage = errorMessage;
    this.logger.error(errorMessage);
  }

  logout() {
    localStorage.removeItem("access_token");
    this.isLoggedIn = false;
    this.emailInput = '';
  }

  clicklogout() {
    this.logout();
    this.showLogoutDialog();
  }

  expiredlogout() {
    this.logout();
    this.showSessionExpiredDialog();
  }

  protected readonly WrappedTicket = WrappedTicket;
}
